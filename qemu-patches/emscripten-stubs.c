/*
 * Stubs for symbols missing in emscripten sysroot.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

#ifdef __EMSCRIPTEN__

#include <errno.h>
#include <unistd.h>
#include <stddef.h>
#include <stdlib.h>

/* copy_file_range is not available in emscripten */
ssize_t copy_file_range(int fd_in, off_t *off_in, int fd_out, off_t *off_out,
                        size_t len, unsigned int flags)
{
    errno = ENOSYS;
    return -1;
}

/* posix_spawnp is used by glib but not available in emscripten */
#include <spawn.h>
int posix_spawnp(pid_t *pid, const char *file,
                 const posix_spawn_file_actions_t *file_actions,
                 const posix_spawnattr_t *attrp,
                 char *const argv[], char *const envp[])
{
    errno = ENOSYS;
    return -1;
}

/* pthread_kill - not available without shared memory threading */
#include <pthread.h>
#include <signal.h>
int pthread_kill(pthread_t thread, int sig)
{
    /* In emscripten single-threaded mode, only signal the current thread */
    if (sig != 0) {
        raise(sig);
    }
    return 0;
}

/* sigsuspend - used by coroutine-sigaltstack, stub for emscripten */
int sigsuspend(const sigset_t *mask)
{
    errno = EINTR;
    return -1;
}

/* initgroups - not available in emscripten */
#include <grp.h>
int initgroups(const char *user, gid_t group)
{
    errno = ENOSYS;
    return -1;
}

/* pipe2 - not available in emscripten */
#include <fcntl.h>
int pipe2(int pipefd[2], int flags)
{
    /* Use regular pipe() as fallback */
    return pipe(pipefd);
}

#endif /* __EMSCRIPTEN__ */
