export declare enum LogLevel {
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
}
interface ILogInfo {
    code: number;
    category: LogLevel;
    message: string;
    solution?: string;
}
/**
 * 诊断信息采用单 Code 模式对应一个 Message 的模式
 * 采用 4 位 Code 表示错误码，当遇到一个解决方案，
 * 1xxx => 一些警告信息
 * 4xxx => 用户使用上的问题
 * 5xxx => 框架或者客户端造成的异常
 */
export declare const diagnosticMessageMap: {
    config_debug_deprecated: ILogInfo;
    dd_config_wrap_deprecated: ILogInfo;
    not_support_event_on: ILogInfo;
    not_support_event_off: ILogInfo;
    repeat_config: ILogInfo;
    JsBridge_init_fail: ILogInfo;
    auto_bridge_init_error: ILogInfo;
    JsBridge_init_fail_dd_config: ILogInfo;
    not_support_env: ILogInfo;
    call_api_support_platform_error: ILogInfo;
    call_api_config_platform_error: ILogInfo;
    call_api_on_before_error: ILogInfo;
    call_api_on_after_error: ILogInfo;
};
export declare const formatLog: (diagnosticMessage: ILogInfo, ...args: string[]) => string;
export {};
