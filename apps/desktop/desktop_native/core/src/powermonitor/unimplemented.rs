use napi::threadsafe_function::{ErrorStrategy::CalleeHandled, ThreadsafeFunction};

pub async fn on_lock(_: ThreadsafeFunction<(), CalleeHandled>) -> Result<(), Box<dyn std::error::Error>> {
    return Ok(());
}

pub async fn is_lock_monitor_available() -> bool {
    return false;
}
