export declare const apiName = "internal.alpha.discover";
/**
 * 开启/关闭发现服务 请求参数定义
 * @apiName internal.alpha.discover
 */
export interface IInternalAlphaDiscoverParams {
    /** 开启/关闭功能 boolean 可选（默认false） */
    enable?: boolean;
}
/**
 * 开启/关闭发现服务 返回结果定义
 * @apiName internal.alpha.discover
 */
export interface IInternalAlphaDiscoverResult {
    [key: string]: any;
}
/**
 * 开启/关闭发现服务
 * @apiName internal.alpha.discover
 * @supportVersion android: 4.6.9 ios: 4.6.11
 */
export declare function discover$(params: IInternalAlphaDiscoverParams): Promise<IInternalAlphaDiscoverResult>;
export default discover$;
