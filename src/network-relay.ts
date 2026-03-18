/**
 * network-relay.ts — Self-contained network relay for v86 inside a Durable Object.
 *
 * Parses raw Ethernet frames from v86's NE2K, handles ARP/DHCP/DNS/TCP/ICMP,
 * and proxies real TCP connections via Cloudflare Workers `connect()`.
 * No external relay server required.
 *
 * Exports:
 *   - NetworkRelay:      core relay with handleFrame()/onReceive callback
 *   - DONetworkAdapter:  v86-compatible adapter class wired to the relay
 */

import { connect } from "cloudflare:sockets";

// ─── Constants ────────────────────────────────────────────────────────────────

const ETH_HEADER_SIZE = 14;
const IPV4_HEADER_SIZE = 20;
const TCP_HEADER_SIZE = 20;
const UDP_HEADER_SIZE = 8;
const ARP_SIZE = 28;
const ICMP_HEADER_SIZE = 8; // type(1) + code(1) + checksum(2) + id(2) + seq(2)

const ETHERTYPE_IPV4 = 0x0800;
const ETHERTYPE_ARP = 0x0806;

const IPPROTO_ICMP = 1;
const IPPROTO_TCP = 6;
const IPPROTO_UDP = 17;

const DHCP_SERVER_PORT = 67;
const DHCP_CLIENT_PORT = 68;
const DNS_PORT = 53;

const TCP_FIN = 0x01;
const TCP_SYN = 0x02;
const TCP_RST = 0x04;
const TCP_PSH = 0x08;
const TCP_ACK = 0x10;

const MTU = 1500;
const TCP_MSS = MTU - IPV4_HEADER_SIZE - TCP_HEADER_SIZE; // 1460

// Virtual network configuration
const GATEWAY_MAC: readonly number[] = [0x52, 0x54, 0x00, 0x01, 0x02, 0x03];
const GATEWAY_IP: readonly number[] = [192, 168, 1, 1];
const CLIENT_IP: readonly number[] = [192, 168, 1, 2];
const SUBNET_MASK: readonly number[] = [255, 255, 255, 0];
const LEASE_TIME = 0x00278D00; // 2,592,000 seconds = 30 days

// ─── Checksum ─────────────────────────────────────────────────────────────────

/** RFC 1071 internet checksum over a region of a buffer. */
function inetChecksum(buf: Uint8Array, offset: number, length: number, initial = 0): number {
  let sum = initial;
  const end = offset + (length & ~1);
  for (let i = offset; i < end; i += 2) {
    sum += (buf[i]! << 8) | buf[i + 1]!;
  }
  if (length & 1) {
    sum += buf[offset + length - 1]! << 8;
  }
  while (sum >>> 16) {
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return ~sum & 0xffff;
}

/** Compute IPv4 pseudo-header partial checksum for TCP/UDP. */
function pseudoHeaderSum(
  srcIp: Uint8Array | readonly number[], dstIp: Uint8Array | readonly number[],
  proto: number, segmentLen: number,
): number {
  return (
    ((srcIp[0]! << 8) | srcIp[1]!) +
    ((srcIp[2]! << 8) | srcIp[3]!) +
    ((dstIp[0]! << 8) | dstIp[1]!) +
    ((dstIp[2]! << 8) | dstIp[3]!) +
    proto +
    segmentLen
  );
}

// ─── Minimal packet parsers ──────────────────────────────────────────────────

interface EthHeader {
  dstMac: Uint8Array;  // 6 bytes
  srcMac: Uint8Array;  // 6 bytes
  ethertype: number;
}

interface ArpPacket {
  htype: number;
  ptype: number;
  oper: number;
  sha: Uint8Array; // sender hardware address (6)
  spa: Uint8Array; // sender protocol address (4)
  tha: Uint8Array; // target hardware address (6)
  tpa: Uint8Array; // target protocol address (4)
}

interface Ipv4Header {
  ihl: number;
  totalLen: number;
  id: number;
  flags: number;
  ttl: number;
  proto: number;
  srcIp: Uint8Array; // 4 bytes
  dstIp: Uint8Array; // 4 bytes
  headerLen: number;  // ihl * 4
}

interface TcpHeader {
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  dataOffset: number; // in bytes
  flags: number;
  window: number;
  payload: Uint8Array;
}

interface UdpHeader {
  srcPort: number;
  dstPort: number;
  length: number;
  payload: Uint8Array;
}

interface IcmpHeader {
  type: number;
  code: number;
  id: number;
  seq: number;
  data: Uint8Array; // everything after the 8-byte ICMP header
}

function parseEth(buf: Uint8Array): EthHeader | null {
  if (buf.length < ETH_HEADER_SIZE) return null;
  return {
    dstMac: buf.subarray(0, 6),
    srcMac: buf.subarray(6, 12),
    ethertype: (buf[12]! << 8) | buf[13]!,
  };
}

function parseArp(buf: Uint8Array, offset: number): ArpPacket | null {
  if (buf.length < offset + ARP_SIZE) return null;
  return {
    htype: (buf[offset]! << 8) | buf[offset + 1]!,
    ptype: (buf[offset + 2]! << 8) | buf[offset + 3]!,
    oper:  (buf[offset + 6]! << 8) | buf[offset + 7]!,
    sha:   buf.subarray(offset + 8, offset + 14),
    spa:   buf.subarray(offset + 14, offset + 18),
    tha:   buf.subarray(offset + 18, offset + 24),
    tpa:   buf.subarray(offset + 24, offset + 28),
  };
}

function parseIpv4(buf: Uint8Array, offset: number): Ipv4Header | null {
  if (buf.length < offset + IPV4_HEADER_SIZE) return null;
  const ihl = buf[offset]! & 0x0f;
  const headerLen = ihl * 4;
  if (buf.length < offset + headerLen) return null;
  return {
    ihl,
    totalLen:  (buf[offset + 2]! << 8) | buf[offset + 3]!,
    id:        (buf[offset + 4]! << 8) | buf[offset + 5]!,
    flags:     buf[offset + 6]! >> 5,
    ttl:       buf[offset + 8]!,
    proto:     buf[offset + 9]!,
    srcIp:     buf.subarray(offset + 12, offset + 16),
    dstIp:     buf.subarray(offset + 16, offset + 20),
    headerLen,
  };
}

function parseTcp(buf: Uint8Array, offset: number): TcpHeader | null {
  if (buf.length < offset + TCP_HEADER_SIZE) return null;
  const dataOffset = ((buf[offset + 12]! >> 4) & 0x0f) * 4;
  return {
    srcPort:    (buf[offset]! << 8) | buf[offset + 1]!,
    dstPort:    (buf[offset + 2]! << 8) | buf[offset + 3]!,
    seq:        ((buf[offset + 4]! << 24) | (buf[offset + 5]! << 16) | (buf[offset + 6]! << 8) | buf[offset + 7]!) >>> 0,
    ack:        ((buf[offset + 8]! << 24) | (buf[offset + 9]! << 16) | (buf[offset + 10]! << 8) | buf[offset + 11]!) >>> 0,
    dataOffset,
    flags:      buf[offset + 13]!,
    window:     (buf[offset + 14]! << 8) | buf[offset + 15]!,
    payload:    buf.subarray(offset + dataOffset),
  };
}

function parseUdp(buf: Uint8Array, offset: number): UdpHeader | null {
  if (buf.length < offset + UDP_HEADER_SIZE) return null;
  const length = (buf[offset + 4]! << 8) | buf[offset + 5]!;
  return {
    srcPort: (buf[offset]! << 8) | buf[offset + 1]!,
    dstPort: (buf[offset + 2]! << 8) | buf[offset + 3]!,
    length,
    payload: buf.subarray(offset + UDP_HEADER_SIZE, offset + length),
  };
}

function parseIcmp(buf: Uint8Array, offset: number): IcmpHeader | null {
  if (buf.length < offset + ICMP_HEADER_SIZE) return null;
  return {
    type: buf[offset]!,
    code: buf[offset + 1]!,
    id:   (buf[offset + 4]! << 8) | buf[offset + 5]!,
    seq:  (buf[offset + 6]! << 8) | buf[offset + 7]!,
    data: buf.subarray(offset + ICMP_HEADER_SIZE),
  };
}

// ─── Packet builders ─────────────────────────────────────────────────────────

function macBytes(mac: readonly number[]): Uint8Array {
  return new Uint8Array(mac);
}

function ipBytes(ip: readonly number[]): Uint8Array {
  return new Uint8Array(ip);
}

const BROADCAST_MAC = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

/** Write a 6-byte MAC into buf at offset. */
function writeMac(buf: Uint8Array, offset: number, mac: Uint8Array | readonly number[]): void {
  for (let i = 0; i < 6; i++) buf[offset + i] = mac[i]!;
}

/** Write a 4-byte IP into buf at offset. */
function writeIp(buf: Uint8Array, offset: number, ip: Uint8Array | readonly number[]): void {
  for (let i = 0; i < 4; i++) buf[offset + i] = ip[i]!;
}

/** Write a uint16 big-endian. */
function writeU16(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = (val >> 8) & 0xff;
  buf[offset + 1] = val & 0xff;
}

/** Write a uint32 big-endian. */
function writeU32(buf: Uint8Array, offset: number, val: number): void {
  buf[offset]     = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

/** Build a complete Ethernet frame. Returns a new Uint8Array (copy). */
function buildEthFrame(
  dstMac: Uint8Array | readonly number[],
  srcMac: Uint8Array | readonly number[],
  ethertype: number,
  payload: Uint8Array,
): Uint8Array {
  const frame = new Uint8Array(ETH_HEADER_SIZE + payload.length);
  writeMac(frame, 0, dstMac);
  writeMac(frame, 6, srcMac);
  writeU16(frame, 12, ethertype);
  frame.set(payload, ETH_HEADER_SIZE);
  return frame;
}

/** Build an IPv4 packet (no options). Computes header checksum. */
function buildIpv4(
  srcIp: Uint8Array | readonly number[],
  dstIp: Uint8Array | readonly number[],
  proto: number,
  payload: Uint8Array,
  id = 0,
): Uint8Array {
  const totalLen = IPV4_HEADER_SIZE + payload.length;
  const pkt = new Uint8Array(totalLen);
  pkt[0] = 0x45; // version=4, ihl=5
  writeU16(pkt, 2, totalLen);
  writeU16(pkt, 4, id);
  pkt[6] = 0x40; // Don't Fragment
  pkt[8] = 64;   // TTL
  pkt[9] = proto;
  // checksum at [10..11] = 0 for now
  writeIp(pkt, 12, srcIp);
  writeIp(pkt, 16, dstIp);
  // compute header checksum
  const cksum = inetChecksum(pkt, 0, IPV4_HEADER_SIZE);
  writeU16(pkt, 10, cksum);
  pkt.set(payload, IPV4_HEADER_SIZE);
  return pkt;
}

/** Build a UDP datagram. Computes UDP checksum with pseudo-header. */
function buildUdp(
  srcPort: number, dstPort: number,
  srcIp: Uint8Array | readonly number[],
  dstIp: Uint8Array | readonly number[],
  payload: Uint8Array,
): Uint8Array {
  const udpLen = UDP_HEADER_SIZE + payload.length;
  const seg = new Uint8Array(udpLen);
  writeU16(seg, 0, srcPort);
  writeU16(seg, 2, dstPort);
  writeU16(seg, 4, udpLen);
  // checksum at [6..7] = 0 for now
  seg.set(payload, UDP_HEADER_SIZE);
  const ph = pseudoHeaderSum(srcIp, dstIp, IPPROTO_UDP, udpLen);
  const cksum = inetChecksum(seg, 0, udpLen, ph);
  writeU16(seg, 6, cksum || 0xffff); // UDP: 0 checksum transmitted as 0xFFFF
  return seg;
}

/**
 * Build a TCP segment. Computes TCP checksum with pseudo-header.
 * optionalMss: if set, adds a 4-byte MSS option (increases header to 24 bytes).
 */
function buildTcp(
  srcPort: number, dstPort: number,
  srcIp: Uint8Array | readonly number[],
  dstIp: Uint8Array | readonly number[],
  seq: number, ack: number,
  flags: number, window: number,
  payload: Uint8Array | null,
  mss?: number,
): Uint8Array {
  const hasMss = mss !== undefined;
  const optionsLen = hasMss ? 4 : 0;
  const headerLen = TCP_HEADER_SIZE + optionsLen;
  const dataLen = payload ? payload.length : 0;
  const segLen = headerLen + dataLen;
  const seg = new Uint8Array(segLen);

  writeU16(seg, 0, srcPort);
  writeU16(seg, 2, dstPort);
  writeU32(seg, 4, seq);
  writeU32(seg, 8, ack);
  seg[12] = (headerLen / 4) << 4; // data offset
  seg[13] = flags;
  writeU16(seg, 14, window);
  // checksum at [16..17] = 0 for now
  // urgent pointer at [18..19] = 0

  if (hasMss) {
    seg[20] = 0x02; // MSS option kind
    seg[21] = 0x04; // MSS option length
    writeU16(seg, 22, mss!);
  }

  if (payload && dataLen > 0) {
    seg.set(payload, headerLen);
  }

  const ph = pseudoHeaderSum(srcIp, dstIp, IPPROTO_TCP, segLen);
  const cksum = inetChecksum(seg, 0, segLen, ph);
  writeU16(seg, 16, cksum);
  return seg;
}

// ─── ARP responder ───────────────────────────────────────────────────────────

function buildArpReply(
  request: ArpPacket,
  gatewayMac: readonly number[],
): Uint8Array {
  const reply = new Uint8Array(ARP_SIZE);
  writeU16(reply, 0, 1);      // htype = Ethernet
  writeU16(reply, 2, 0x0800); // ptype = IPv4
  reply[4] = 6;               // hlen
  reply[5] = 4;               // plen
  writeU16(reply, 6, 2);      // oper = REPLY
  writeMac(reply, 8, gatewayMac);     // sha = gateway MAC
  writeIp(reply, 14, request.tpa);    // spa = the IP they asked about
  writeMac(reply, 18, request.sha);   // tha = requester MAC
  writeIp(reply, 24, request.spa);    // tpa = requester IP
  return reply;
}

// ─── DHCP server ─────────────────────────────────────────────────────────────

const DHCP_MAGIC_COOKIE = 0x63825363;

interface DhcpParsed {
  op: number;
  xid: number;
  chaddr: Uint8Array;
  msgType: number; // DHCP option 53: 1=DISCOVER, 3=REQUEST
}

function parseDhcp(payload: Uint8Array): DhcpParsed | null {
  if (payload.length < 240) return null;
  const op = payload[0]!;
  const xid = ((payload[4]! << 24) | (payload[5]! << 16) |
               (payload[6]! << 8) | payload[7]!) >>> 0;
  const chaddr = payload.subarray(28, 44);
  // magic cookie at 236
  const cookie = ((payload[236]! << 24) | (payload[237]! << 16) |
                  (payload[238]! << 8) | payload[239]!) >>> 0;
  if (cookie !== DHCP_MAGIC_COOKIE) return null;

  // Parse options starting at offset 240
  let msgType = 0;
  let i = 240;
  while (i < payload.length) {
    const optType = payload[i]!;
    if (optType === 255) break; // end
    if (optType === 0) { i++; continue; } // pad
    const optLen = payload[i + 1]!;
    if (optType === 53 && optLen >= 1) {
      msgType = payload[i + 2]!;
    }
    i += 2 + optLen;
  }

  return { op, xid, chaddr, msgType };
}

function buildDhcpResponse(
  request: DhcpParsed,
  isAck: boolean,
): Uint8Array {
  // DHCP response: 240 bytes base + options
  const opts: number[] = [];

  // Option 53: Message Type (OFFER=2 or ACK=5)
  opts.push(53, 1, isAck ? 5 : 2);

  // Option 1: Subnet Mask
  opts.push(1, 4, ...SUBNET_MASK);

  // Option 3: Router
  opts.push(3, 4, ...GATEWAY_IP);

  // Option 6: DNS Server
  opts.push(6, 4, ...GATEWAY_IP);

  // Option 54: DHCP Server Identifier
  opts.push(54, 4, ...GATEWAY_IP);

  if (isAck) {
    // Option 51: Lease Time
    opts.push(51, 4,
      (LEASE_TIME >>> 24) & 0xff,
      (LEASE_TIME >>> 16) & 0xff,
      (LEASE_TIME >>> 8) & 0xff,
      LEASE_TIME & 0xff,
    );
  }

  // Option 255: End
  opts.push(255);

  const dhcpLen = 240 + opts.length;
  const dhcp = new Uint8Array(dhcpLen);
  dhcp[0] = 2; // op = BOOTREPLY
  dhcp[1] = 1; // htype = Ethernet
  dhcp[2] = 6; // hlen
  // xid
  writeU32(dhcp, 4, request.xid);
  // yiaddr (your IP address) at offset 16
  writeIp(dhcp, 16, CLIENT_IP);
  // siaddr (server IP) at offset 20
  writeIp(dhcp, 20, GATEWAY_IP);
  // giaddr (gateway IP) at offset 24
  writeIp(dhcp, 24, GATEWAY_IP);
  // chaddr at offset 28 (16 bytes)
  dhcp.set(request.chaddr.subarray(0, 16), 28);
  // magic cookie at 236
  writeU32(dhcp, 236, DHCP_MAGIC_COOKIE);
  // options at 240
  for (let i = 0; i < opts.length; i++) {
    dhcp[240 + i] = opts[i]!;
  }

  return dhcp;
}

// ─── TCP NAT state machine ───────────────────────────────────────────────────

const enum TcpState {
  SYN_RECEIVED,
  ESTABLISHED,
  FIN_WAIT_1,
  FIN_WAIT_2,
  CLOSE_WAIT,
  LAST_ACK,
  CLOSING,
  CLOSED,
}

interface TcpConnection {
  key: string;
  state: TcpState;

  // Guest-side addresses (as seen by the VM)
  guestIp: Uint8Array;
  guestPort: number;
  guestMac: Uint8Array;

  // Remote-side addresses (real internet host)
  remoteIp: Uint8Array;
  remotePort: number;

  // Sequence tracking
  /** Our next sequence number (gateway → guest) */
  seq: number;
  /** Next expected sequence number from guest */
  ack: number;

  // Workers TCP socket
  socket: {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    writer: WritableStreamDefaultWriter<Uint8Array>;
    closed: Promise<void>;
  } | null;

  // Send buffer for data from remote → guest (stop-and-wait)
  pendingData: Uint8Array[];
  sending: boolean;

  // Cleanup timer
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const TCP_IDLE_TIMEOUT_MS = 120_000; // 2 minutes

// ─── NetworkRelay ────────────────────────────────────────────────────────────

export class NetworkRelay {
  /** Callback: send a raw Ethernet frame to the guest VM. */
  onReceive: ((frame: Uint8Array) => void) | null = null;

  private guestMac: Uint8Array = new Uint8Array(6);
  private tcpConns = new Map<string, TcpConnection>();
  private ipId = 1;
  private _log: boolean;

  constructor(options?: { debug?: boolean }) {
    this._log = options?.debug ?? false;
  }

  /** Called when the guest VM sends a raw Ethernet frame. */
  handleFrame(data: Uint8Array): void {
    const eth = parseEth(data);
    if (!eth) return;

    // Capture guest MAC from any outbound frame
    if (eth.srcMac[0] !== 0 || eth.srcMac[1] !== 0) {
      this.guestMac = new Uint8Array(eth.srcMac);
    }

    switch (eth.ethertype) {
      case ETHERTYPE_ARP:
        this.handleArp(data, eth);
        break;
      case ETHERTYPE_IPV4:
        this.handleIpv4(data, eth);
        break;
      // Ignore IPv6, etc.
    }
  }

  /** Release all TCP connections and clear state. */
  destroy(): void {
    for (const conn of this.tcpConns.values()) {
      this.closeConnection(conn);
    }
    this.tcpConns.clear();
  }

  // ── ARP ──────────────────────────────────────────────────────────────────

  private handleArp(data: Uint8Array, eth: EthHeader): void {
    const arp = parseArp(data, ETH_HEADER_SIZE);
    if (!arp) return;

    // Only handle ARP REQUEST (oper=1) for IPv4 (ptype=0x0800)
    if (arp.oper !== 1 || arp.ptype !== ETHERTYPE_IPV4) return;

    // Respond to any ARP — we are the gateway for everything (proxy-ARP).
    // This makes the guest route all traffic through us.
    if (this._log) {
      this.log(`ARP WHO-HAS ${ipStr(arp.tpa)} TELL ${ipStr(arp.spa)}`);
    }

    const replyPayload = buildArpReply(arp, GATEWAY_MAC);
    const frame = buildEthFrame(eth.srcMac, GATEWAY_MAC, ETHERTYPE_ARP, replyPayload);
    this.sendToGuest(frame);
  }

  // ── IPv4 dispatch ────────────────────────────────────────────────────────

  private handleIpv4(data: Uint8Array, eth: EthHeader): void {
    const ip = parseIpv4(data, ETH_HEADER_SIZE);
    if (!ip) return;

    const ipPayloadOffset = ETH_HEADER_SIZE + ip.headerLen;

    switch (ip.proto) {
      case IPPROTO_UDP:
        this.handleUdp(data, eth, ip, ipPayloadOffset);
        break;
      case IPPROTO_TCP:
        this.handleTcp(data, eth, ip, ipPayloadOffset);
        break;
      case IPPROTO_ICMP:
        this.handleIcmp(data, eth, ip, ipPayloadOffset);
        break;
    }
  }

  // ── UDP (DHCP + DNS) ─────────────────────────────────────────────────────

  private handleUdp(
    data: Uint8Array, eth: EthHeader, ip: Ipv4Header, offset: number,
  ): void {
    const udp = parseUdp(data, offset);
    if (!udp) return;

    // DHCP (client port 68, server port 67)
    if (udp.dstPort === DHCP_SERVER_PORT && udp.srcPort === DHCP_CLIENT_PORT) {
      this.handleDhcp(udp.payload, eth);
      return;
    }

    // DNS (destination port 53)
    if (udp.dstPort === DNS_PORT) {
      this.handleDns(udp, ip, eth);
      return;
    }

    // All other UDP: silently drop
  }

  // ── DHCP ─────────────────────────────────────────────────────────────────

  private handleDhcp(payload: Uint8Array, eth: EthHeader): void {
    const dhcp = parseDhcp(payload);
    if (!dhcp) return;

    // DISCOVER (1) → OFFER, REQUEST (3) → ACK
    // Note: some DHCP clients send op=1 for REQUEST; detect via option 53.
    const isRequest = dhcp.msgType === 3;
    const responseType = isRequest ? "ACK" : "OFFER";

    if (this._log) {
      this.log(`DHCP ${dhcp.msgType === 1 ? "DISCOVER" : dhcp.msgType === 3 ? "REQUEST" : "msg=" + dhcp.msgType} → ${responseType}`);
    }

    const dhcpReply = buildDhcpResponse(dhcp, isRequest);
    const udpSeg = buildUdp(
      DHCP_SERVER_PORT, DHCP_CLIENT_PORT,
      GATEWAY_IP, CLIENT_IP,
      dhcpReply,
    );
    const ipPkt = buildIpv4(GATEWAY_IP, CLIENT_IP, IPPROTO_UDP, udpSeg, this.nextIpId());
    const frame = buildEthFrame(eth.srcMac, GATEWAY_MAC, ETHERTYPE_IPV4, ipPkt);
    this.sendToGuest(frame);
  }

  // ── DNS (DoH via fetch) ──────────────────────────────────────────────────

  private handleDns(udp: UdpHeader, ip: Ipv4Header, eth: EthHeader): void {
    if (this._log) {
      this.log(`DNS query (${udp.payload.length} bytes) → DoH`);
    }

    // Copy the raw DNS wire-format query — the subarray may be invalidated
    const dnsQuery = new Uint8Array(udp.payload);
    const srcPort = udp.srcPort;
    const srcIp = new Uint8Array(ip.srcIp);
    const srcMac = new Uint8Array(eth.srcMac);

    // Forward to Cloudflare DoH asynchronously
    fetch("https://1.1.1.1/dns-query", {
      method: "POST",
      headers: { "Content-Type": "application/dns-message" },
      body: dnsQuery,
    }).then(async (resp) => {
      if (!resp.ok) {
        if (this._log) this.log(`DoH error: ${resp.status}`);
        return;
      }
      const dnsResponse = new Uint8Array(await resp.arrayBuffer());

      // Wrap DNS response back into UDP → IPv4 → Ethernet
      const udpSeg = buildUdp(DNS_PORT, srcPort, GATEWAY_IP, srcIp, dnsResponse);
      const ipPkt = buildIpv4(GATEWAY_IP, srcIp, IPPROTO_UDP, udpSeg, this.nextIpId());
      const frame = buildEthFrame(srcMac, GATEWAY_MAC, ETHERTYPE_IPV4, ipPkt);
      this.sendToGuest(frame);
    }).catch((err) => {
      if (this._log) this.log(`DoH fetch failed: ${err}`);
    });
  }

  // ── ICMP ─────────────────────────────────────────────────────────────────

  private handleIcmp(
    data: Uint8Array, eth: EthHeader, ip: Ipv4Header, offset: number,
  ): void {
    const icmp = parseIcmp(data, offset);
    if (!icmp || icmp.type !== 8) return; // Only handle Echo Request

    // Only respond to pings aimed at the gateway; drop others.
    const isGateway = ip.dstIp[0] === GATEWAY_IP[0] && ip.dstIp[1] === GATEWAY_IP[1] &&
                      ip.dstIp[2] === GATEWAY_IP[2] && ip.dstIp[3] === GATEWAY_IP[3];
    if (!isGateway) return;

    if (this._log) this.log(`ICMP echo request → reply`);

    // Build ICMP Echo Reply (type=0)
    // We need to include the full ICMP data after the 8-byte header
    const icmpPayloadLen = ip.totalLen - ip.headerLen - ICMP_HEADER_SIZE;
    const icmpLen = ICMP_HEADER_SIZE + Math.max(icmpPayloadLen, 0);
    const icmpReply = new Uint8Array(icmpLen);
    icmpReply[0] = 0; // type = Echo Reply
    icmpReply[1] = 0; // code
    // checksum at [2..3] = 0 for now
    writeU16(icmpReply, 4, icmp.id);
    writeU16(icmpReply, 6, icmp.seq);
    if (icmp.data.length > 0) {
      icmpReply.set(icmp.data.subarray(0, icmpPayloadLen), ICMP_HEADER_SIZE);
    }
    const cksum = inetChecksum(icmpReply, 0, icmpLen);
    writeU16(icmpReply, 2, cksum);

    const ipPkt = buildIpv4(GATEWAY_IP, ip.srcIp, IPPROTO_ICMP, icmpReply, this.nextIpId());
    const frame = buildEthFrame(eth.srcMac, GATEWAY_MAC, ETHERTYPE_IPV4, ipPkt);
    this.sendToGuest(frame);
  }

  // ── TCP NAT ──────────────────────────────────────────────────────────────

  private handleTcp(
    data: Uint8Array, eth: EthHeader, ip: Ipv4Header, offset: number,
  ): void {
    const tcp = parseTcp(data, offset);
    if (!tcp) return;

    const key = `${ipStr(ip.srcIp)}:${tcp.srcPort}:${ipStr(ip.dstIp)}:${tcp.dstPort}`;

    // ── SYN (new connection) ───────────────────────────────────────────────
    if ((tcp.flags & TCP_SYN) && !(tcp.flags & TCP_ACK)) {
      if (this.tcpConns.has(key)) {
        // Retransmitted SYN — ignore, the original is being processed
        return;
      }

      if (this._log) {
        this.log(`TCP SYN ${ipStr(ip.srcIp)}:${tcp.srcPort} → ${ipStr(ip.dstIp)}:${tcp.dstPort}`);
      }

      this.openTcpConnection(key, ip, tcp, eth);
      return;
    }

    // ── Existing connection ────────────────────────────────────────────────
    const conn = this.tcpConns.get(key);
    if (!conn) {
      // Unknown connection — send RST
      this.sendTcpRst(ip, tcp, eth);
      return;
    }

    this.processTcpPacket(conn, tcp, ip, eth);
  }

  private async openTcpConnection(
    key: string, ip: Ipv4Header, tcp: TcpHeader, eth: EthHeader,
  ): Promise<void> {
    const conn: TcpConnection = {
      key,
      state: TcpState.SYN_RECEIVED,
      guestIp: new Uint8Array(ip.srcIp),
      guestPort: tcp.srcPort,
      guestMac: new Uint8Array(eth.srcMac),
      remoteIp: new Uint8Array(ip.dstIp),
      remotePort: tcp.dstPort,
      seq: (Math.random() * 0x7fffffff) >>> 0,
      ack: (tcp.seq + 1) >>> 0,
      socket: null,
      pendingData: [],
      sending: false,
      idleTimer: null,
    };

    this.tcpConns.set(key, conn);
    this.resetIdleTimer(conn);

    // Try to establish the outbound TCP connection via Workers connect()
    try {
      const addr = `${ipStr(conn.remoteIp)}:${conn.remotePort}`;
      const sock = connect(addr);
      const writer = sock.writable.getWriter();

      conn.socket = {
        readable: sock.readable,
        writable: sock.writable,
        writer,
        closed: sock.closed,
      };

      // Send SYN-ACK to guest
      this.sendTcpSegment(conn, TCP_SYN | TCP_ACK, null, TCP_MSS);
      conn.seq = (conn.seq + 1) >>> 0; // SYN consumes one sequence number

      // Start reading from remote socket → guest
      this.pumpRemoteToGuest(conn);

      // Handle remote socket close
      sock.closed.then(() => {
        if (conn.state === TcpState.ESTABLISHED || conn.state === TcpState.SYN_RECEIVED) {
          // Remote closed — send FIN to guest
          conn.state = TcpState.CLOSE_WAIT;
          this.sendTcpSegment(conn, TCP_FIN | TCP_ACK, null);
          conn.seq = (conn.seq + 1) >>> 0; // FIN consumes a sequence number
          conn.state = TcpState.LAST_ACK;
        }
      }).catch(() => {
        // Connection error — RST the guest side
        this.sendTcpSegment(conn, TCP_RST | TCP_ACK, null);
        this.releaseConnection(conn);
      });
    } catch (err) {
      if (this._log) this.log(`TCP connect failed: ${err}`);
      // Connection refused — send RST to guest
      this.sendTcpRst(ip, tcp, eth);
      this.tcpConns.delete(key);
      return;
    }
  }

  private processTcpPacket(
    conn: TcpConnection, tcp: TcpHeader, ip: Ipv4Header, eth: EthHeader,
  ): void {
    this.resetIdleTimer(conn);

    // ── RST from guest ───────────────────────────────────────────────────
    if (tcp.flags & TCP_RST) {
      if (this._log) this.log(`TCP RST from guest on ${conn.key}`);
      this.releaseConnection(conn);
      return;
    }

    switch (conn.state) {
      case TcpState.SYN_RECEIVED:
        // Expecting ACK to complete handshake
        if (tcp.flags & TCP_ACK) {
          conn.state = TcpState.ESTABLISHED;
          if (this._log) this.log(`TCP ESTABLISHED ${conn.key}`);
          // Flush any pending data from remote
          this.flushPendingToGuest(conn);
        }
        break;

      case TcpState.ESTABLISHED:
        this.handleEstablished(conn, tcp);
        break;

      case TcpState.FIN_WAIT_1:
        if ((tcp.flags & TCP_FIN) && (tcp.flags & TCP_ACK)) {
          // Simultaneous close — ACK their FIN, done
          conn.ack = (tcp.seq + 1) >>> 0;
          this.sendTcpSegment(conn, TCP_ACK, null);
          this.releaseConnection(conn);
        } else if (tcp.flags & TCP_ACK) {
          conn.state = TcpState.FIN_WAIT_2;
        } else if (tcp.flags & TCP_FIN) {
          conn.ack = (tcp.seq + 1) >>> 0;
          this.sendTcpSegment(conn, TCP_ACK, null);
          conn.state = TcpState.CLOSING;
        }
        break;

      case TcpState.FIN_WAIT_2:
        if (tcp.flags & TCP_FIN) {
          conn.ack = (tcp.seq + 1) >>> 0;
          this.sendTcpSegment(conn, TCP_ACK, null);
          this.releaseConnection(conn);
        }
        break;

      case TcpState.CLOSING:
        if (tcp.flags & TCP_ACK) {
          this.releaseConnection(conn);
        }
        break;

      case TcpState.LAST_ACK:
        if (tcp.flags & TCP_ACK) {
          this.releaseConnection(conn);
        }
        break;

      case TcpState.CLOSE_WAIT:
        // We already sent FIN, waiting for guest ACK — handled above in LAST_ACK
        // But if guest sends data in CLOSE_WAIT, just ACK it
        if (tcp.payload.length > 0) {
          conn.ack = (tcp.seq + tcp.payload.length) >>> 0;
          this.sendTcpSegment(conn, TCP_ACK, null);
        }
        break;
    }
  }

  private handleEstablished(conn: TcpConnection, tcp: TcpHeader): void {
    // ── Guest sends data ─────────────────────────────────────────────────
    if (tcp.payload.length > 0) {
      conn.ack = (tcp.seq + tcp.payload.length) >>> 0;
      this.sendTcpSegment(conn, TCP_ACK, null);

      // Forward data to the remote socket
      if (conn.socket) {
        const copy = new Uint8Array(tcp.payload);
        conn.socket.writer.write(copy).catch(() => {
          // Write failed — remote is gone
          this.sendTcpSegment(conn, TCP_RST | TCP_ACK, null);
          this.releaseConnection(conn);
        });
      }
    } else if (tcp.flags & TCP_ACK) {
      // Pure ACK — check for keep-alive probes
      if (tcp.seq === (conn.ack - 1) >>> 0) {
        // Keep-alive probe: respond with current ACK
        this.sendTcpSegment(conn, TCP_ACK, null);
      }
      // Otherwise: normal ACK, no action needed (we don't do send-side flow control)
    }

    // ── Guest sends FIN ──────────────────────────────────────────────────
    if (tcp.flags & TCP_FIN) {
      conn.ack = (tcp.seq + 1) >>> 0;
      if (tcp.payload.length > 0) {
        // FIN with data — ack covers data + FIN
        conn.ack = (tcp.seq + tcp.payload.length + 1) >>> 0;
      }
      this.sendTcpSegment(conn, TCP_ACK, null);

      // Close the remote write side
      if (conn.socket) {
        conn.socket.writer.close().catch(() => {});
      }

      // Send our FIN to guest
      this.sendTcpSegment(conn, TCP_FIN | TCP_ACK, null);
      conn.seq = (conn.seq + 1) >>> 0;
      conn.state = TcpState.LAST_ACK;
    }
  }

  /** Read data from the remote socket and send it to the guest as TCP segments. */
  private async pumpRemoteToGuest(conn: TcpConnection): Promise<void> {
    if (!conn.socket) return;

    try {
      const reader = conn.socket.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        // Split into MSS-sized chunks and send to guest
        let offset = 0;
        while (offset < value.length) {
          const chunkSize = Math.min(value.length - offset, TCP_MSS);
          const chunk = value.subarray(offset, offset + chunkSize);

          if (conn.state === TcpState.CLOSED) return;

          this.sendTcpSegment(conn, TCP_PSH | TCP_ACK, chunk);
          conn.seq = (conn.seq + chunk.length) >>> 0;
          offset += chunkSize;
        }
      }
    } catch (err) {
      if (this._log) this.log(`TCP read error on ${conn.key}: ${err}`);
    }

    // Stream ended — if still established, initiate close from our side
    if (conn.state === TcpState.ESTABLISHED) {
      this.sendTcpSegment(conn, TCP_FIN | TCP_ACK, null);
      conn.seq = (conn.seq + 1) >>> 0;
      conn.state = TcpState.FIN_WAIT_1;
    }
  }

  /** Flush any buffered remote data to the guest. */
  private flushPendingToGuest(conn: TcpConnection): void {
    while (conn.pendingData.length > 0) {
      const chunk = conn.pendingData.shift()!;
      this.sendTcpSegment(conn, TCP_PSH | TCP_ACK, chunk);
      conn.seq = (conn.seq + chunk.length) >>> 0;
    }
  }

  /** Build and send a TCP segment from gateway to guest. */
  private sendTcpSegment(
    conn: TcpConnection, flags: number, data: Uint8Array | null, mss?: number,
  ): void {
    const tcpSeg = buildTcp(
      conn.remotePort, conn.guestPort,
      conn.remoteIp, conn.guestIp,
      conn.seq, conn.ack,
      flags, 65535,
      data,
      mss,
    );
    const ipPkt = buildIpv4(conn.remoteIp, conn.guestIp, IPPROTO_TCP, tcpSeg, this.nextIpId());
    const frame = buildEthFrame(conn.guestMac, GATEWAY_MAC, ETHERTYPE_IPV4, ipPkt);
    this.sendToGuest(frame);
  }

  /** Send a RST for an unknown connection. */
  private sendTcpRst(ip: Ipv4Header, tcp: TcpHeader, eth: EthHeader): void {
    const rstAck = (tcp.seq + Math.max(tcp.payload.length, 1)) >>> 0;
    const tcpSeg = buildTcp(
      tcp.dstPort, tcp.srcPort,
      ip.dstIp, ip.srcIp,
      0, rstAck,
      TCP_RST | TCP_ACK, 0,
      null,
    );
    const ipPkt = buildIpv4(ip.dstIp, ip.srcIp, IPPROTO_TCP, tcpSeg, this.nextIpId());
    const frame = buildEthFrame(eth.srcMac, GATEWAY_MAC, ETHERTYPE_IPV4, ipPkt);
    this.sendToGuest(frame);
  }

  private closeConnection(conn: TcpConnection): void {
    if (conn.idleTimer) {
      clearTimeout(conn.idleTimer);
      conn.idleTimer = null;
    }
    if (conn.socket) {
      try { conn.socket.writer.close().catch(() => {}); } catch {}
    }
    conn.state = TcpState.CLOSED;
  }

  private releaseConnection(conn: TcpConnection): void {
    if (this._log) this.log(`TCP release ${conn.key}`);
    this.closeConnection(conn);
    this.tcpConns.delete(conn.key);
  }

  private resetIdleTimer(conn: TcpConnection): void {
    if (conn.idleTimer) clearTimeout(conn.idleTimer);
    conn.idleTimer = setTimeout(() => {
      if (this._log) this.log(`TCP idle timeout ${conn.key}`);
      if (conn.state === TcpState.ESTABLISHED) {
        this.sendTcpSegment(conn, TCP_FIN | TCP_ACK, null);
        conn.seq = (conn.seq + 1) >>> 0;
        conn.state = TcpState.FIN_WAIT_1;
      }
      // Give the guest 5s to ACK the FIN, then force-release
      setTimeout(() => {
        if (this.tcpConns.has(conn.key)) {
          this.releaseConnection(conn);
        }
      }, 5_000);
    }, TCP_IDLE_TIMEOUT_MS);
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  private nextIpId(): number {
    return this.ipId++ & 0xffff;
  }

  private sendToGuest(frame: Uint8Array): void {
    if (this.onReceive) {
      this.onReceive(frame);
    }
  }

  private log(msg: string): void {
    console.log(`[net-relay] ${msg}`);
  }
}

// ─── DONetworkAdapter (v86-compatible) ───────────────────────────────────────
//
// Implements the v86 network adapter interface.  Wires bus events to the relay.
//
// Usage (in linux-vm.ts):
//   const adapter = new DONetworkAdapter(emulator.bus, relay);
//   // v86 config: network_relay_url is NOT needed; wire the adapter manually.
//   // After new V86(), assign: (emulator as any).network_adapter = adapter;
//
// Or, for cleaner integration, set the adapter on the V86 instance directly:
//   emulator.network_adapter = adapter;

export class DONetworkAdapter {
  private bus: any;
  private id: number;
  private relay: NetworkRelay;

  constructor(bus: any, relay: NetworkRelay, config?: { id?: number }) {
    this.bus = bus;
    this.id = config?.id ?? 0;
    this.relay = relay;

    // Guest → relay: NIC fires "net{id}-send" with raw Ethernet frames
    this.bus.register("net" + this.id + "-send", (data: Uint8Array) => {
      this.relay.handleFrame(data);
    }, this);

    // Relay → guest: inject frames via "net{id}-receive" bus event
    this.relay.onReceive = (frame: Uint8Array) => {
      this.bus.send("net" + this.id + "-receive", new Uint8Array(frame));
    };
  }

  destroy(): void {
    this.relay.destroy();
    this.relay.onReceive = null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ipStr(ip: Uint8Array | readonly number[]): string {
  return `${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}`;
}
