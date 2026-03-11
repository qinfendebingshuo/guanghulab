export declare const apiName = "internal.user.bindTaobao";
/**
 * 唤起淘宝登录界面，将当前钉钉账号和淘宝账号绑定 请求参数定义
 * @apiName internal.user.bindTaobao
 */
export interface IInternalUserBindTaobaoParams {
    [key: string]: any;
}
/**
 * 唤起淘宝登录界面，将当前钉钉账号和淘宝账号绑定 返回结果定义
 * @apiName internal.user.bindTaobao
 */
export interface IInternalUserBindTaobaoResult {
    [key: string]: any;
}
/**
 * 唤起淘宝登录界面，将当前钉钉账号和淘宝账号绑定
 * @apiName internal.user.bindTaobao
 * @supportVersion ios: 4.5.13 android: 4.5.13
 */
export declare function bindTaobao$(params: IInternalUserBindTaobaoParams): Promise<IInternalUserBindTaobaoResult>;
export default bindTaobao$;
