import { IErrorMessage, ICallbackOption, ICommonAPI, IJSBridge, IInvokeAPIConfigMap, IAPIConfig, IJSBridgeMap, IInvokeAPIConfigMapByMethod, IUNCore, ILogFn, IDevConfigParams, ILog, IConfigCoreMap, IENV, APP_TYPE, IPlatformConfig, LogLevel, isFunction, compareVersion, ENV_ENUM, ENV_ENUM_SUB, IApiMiddlewareFn } from './sdkLib';
export { IErrorMessage, ICallbackOption, ICommonAPI, IJSBridge, IPlatformConfig, ENV_ENUM, ENV_ENUM_SUB, IENV, compareVersion, isFunction, APP_TYPE, ILogFn, IUNCore, LogLevel, ILog, IInvokeAPIConfigMap, IAPIConfig, IJSBridgeMap, IInvokeAPIConfigMapByMethod, };
export declare function getTargetApiConfigVS(apiConfig: IAPIConfig | undefined, env: IENV): string | undefined;
export declare class Sdk {
    bridgeInitFn: () => Promise<IJSBridge>;
    protected configJsApiList: string[];
    protected hadConfig: boolean;
    protected isReady: undefined | boolean;
    protected devConfig: IDevConfigParams;
    protected env: IENV;
    protected invokeAPIConfigMapByMethod: IInvokeAPIConfigMapByMethod;
    protected p: any;
    protected config$: Promise<unknown>;
    private bridgeInitFnPromise;
    private exportSdk;
    private apiHandler;
    private platformConfigMap;
    private isBridgeDrity;
    constructor(env: IENV);
    getExportSdk: () => IUNCore;
    setAPI: (method: string, config: IInvokeAPIConfigMap) => void;
    setPlatform: (core: IPlatformConfig) => void;
    getPlatformConfigMap: () => IConfigCoreMap;
    deleteApiConfig: (method: string, platform: string) => void;
    /**
     * 配置中间件，最晚加入的中间件最先被调用，并最后返回
     * @param fn 中间件函数
     * @remark
     * context 中携带接口请求的参数和传递中间变量
     * 1. 总是存在的字段代表入口参数，可以读取，请勿修改
     * 2. 可选的字段代表内部中间件可能产生的中间变量，请勿依赖和改动
     * 3. 尽可能不要使用 context 传递中间变量
     *
     * next 是一个异步函数，代表下一个中间件，Promise 的结果代表调用的结果。
     * 同理，当前中间件需要返回内容（or 抛出异常）作为结果，不可不返回任何内容。
     *
     * 若需要获取 sdk 的 protected 字段，可以参考 src/lib/sdk/middlewares/ 目录
     * 下的内部中间件的函数 this 参数声明，使用时记得通过 fn.bind(sdk) 绑定 this 变量
     */
    useApiMiddleware(fn: IApiMiddlewareFn): void;
    invokeAPI: (method: string, params?: any, isAuthApi?: boolean) => Promise<any>;
    private withDefaultEvent;
    private initApiMiddleware;
}
