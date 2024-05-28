use anyhow::Result;
use libc;

pub fn disable_coredumps() -> Result<String> {
    // RLIMIT_CORE is the maximum size of a core dump file. Setting both to 0 disables core dumps, on crashes
    // https://github.com/torvalds/linux/blob/1613e604df0cd359cf2a7fbd9be7a0bcfacfabd0/include/uapi/asm-generic/resource.h#L20
    const RLIMIT_CORE: u32 = 4;
    let rlimit = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    if unsafe { libc::setrlimit(RLIMIT_CORE, &rlimit) } != 0 {
        let e = std::io::Error::last_os_error();
        return Err(anyhow::anyhow!("failed to disable core dumping, memory might be persisted to disk on crashes {}", e))
    }

    Ok("Core dumps disabled".to_string())
}

pub fn is_core_dumping_disabled() -> Result<bool> {
    const RLIMIT_CORE: u32 = 4;
    let mut rlimit = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    if unsafe { libc::getrlimit(RLIMIT_CORE, &mut rlimit) } != 0 {
        let e = std::io::Error::last_os_error();
        return Err(anyhow::anyhow!("failed to get core dump limit {}", e))
    }

    Ok(rlimit.rlim_cur == 0 && rlimit.rlim_max == 0)
}

pub fn disable_memory_access() -> Result<String> {
    // PR_SET_DUMPABLE makes it so no other running process (root or same user) can dump the memory of this process
    // or attach a debugger to it.
    // https://github.com/torvalds/linux/blob/a38297e3fb012ddfa7ce0321a7e5a8daeb1872b6/include/uapi/linux/prctl.h#L14
    const PR_SET_DUMPABLE: i32 = 4;
    if unsafe { libc::prctl(PR_SET_DUMPABLE, 0) } != 0 {
        let e = std::io::Error::last_os_error();
        return Err(anyhow::anyhow!("failed to disable memory dumping, memory is dumpable by other processes {}", e))
    }

    Ok("Core dumps disabled".to_string())
}