use anyhow::Result;
use libc;

pub fn disable_coredumps() -> Result<String> {
    bail!("Not implemented on Mac")
}

pub fn is_core_dumping_disabled() -> Result<bool> {
    bail!("Not implemented on Mac")
}

pub fn disable_memory_access() -> Result<String> {
    bail("Not implemented on Mac")
}