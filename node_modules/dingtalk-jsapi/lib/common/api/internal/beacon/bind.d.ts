export declare const apiName = "internal.beacon.bind";
/**
 * beancon绑定 请求参数定义
 * @apiName internal.beacon.bind
 */
export interface IInternalBeaconBindParams {
    [key: string]: any;
}
/**
 * beancon绑定 返回结果定义
 * @apiName internal.beacon.bind
 */
export interface IInternalBeaconBindResult {
    [key: string]: any;
}
/**
 * beancon绑定
 * @apiName internal.beacon.bind
 * @supportVersion  ios: 3.1.0 android: 3.1.0
 */
export declare function bind$(params: IInternalBeaconBindParams): Promise<IInternalBeaconBindResult>;
export default bind$;
