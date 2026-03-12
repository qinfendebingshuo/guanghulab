export declare const apiName = "internal.ui.getCurrentUIEnvironment";
/**
 * 获取当前小程序在native客户端相关的UI环境特征集合，如displayScale，iPad分屏状态等。未来native的UI相关的通用内容扩展此接口回参来暴露 请求参数定义
 * @apiName internal.ui.getCurrentUIEnvironment
 */
export interface IInternalUiGetCurrentUIEnvironmentParams {
}
/**
 * 获取当前小程序在native客户端相关的UI环境特征集合，如displayScale，iPad分屏状态等。未来native的UI相关的通用内容扩展此接口回参来暴露 返回结果定义
 * @apiName internal.ui.getCurrentUIEnvironment
 */
export interface IInternalUiGetCurrentUIEnvironmentResult {
    /**
     * 当前页面在设备上的缩放值
     * 1.0: iPhone 3gs及以下设备；初代iPad/2/初代Mini
     * 2.0: iPhone 4 ~ 8/SE/Xr/11；iPad Mini/Air/Pro
     * 3.0: iPhone 6p/6sp/7p/8p/X/Xs/11 Pro等
     */
    displayScale: number;
    /** 当前页面是否处于iPad 分屏容器中。 true: 当前页面在分屏容器中 false: 当前页面不在分屏容器中 */
    inSplitView: boolean;
    /** 当前页面所属的分屏容器是否处于非分屏状态。true为非分屏状态, false为分屏状态 */
    splitViewCollapsed: boolean;
}
/**
 * 获取当前小程序在native客户端相关的UI环境特征集合，如displayScale，iPad分屏状态等。未来native的UI相关的通用内容扩展此接口回参来暴露
 * @apiName internal.ui.getCurrentUIEnvironment
 * @supportVersion ios: 5.0.0
 * @author iOS: 库珀
 */
export declare function getCurrentUIEnvironment$(params: IInternalUiGetCurrentUIEnvironmentParams): Promise<IInternalUiGetCurrentUIEnvironmentResult>;
export default getCurrentUIEnvironment$;
