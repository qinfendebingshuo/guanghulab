export declare const apiName = "internal.user.unbindTaobao";
/**
 * 钉钉用户手动解除钉钉账号与淘宝账号的绑定 请求参数定义
 * @apiName internal.user.unbindTaobao
 */
export interface IInternalUserUnbindTaobaoParams {
}
/**
 * 钉钉用户手动解除钉钉账号与淘宝账号的绑定 返回结果定义
 * @apiName internal.user.unbindTaobao
 */
export interface IInternalUserUnbindTaobaoResult {
}
/**
 * 钉钉用户手动解除钉钉账号与淘宝账号的绑定
 * @apiName internal.user.unbindTaobao
 * @supportVersion ios: 4.7.16 android: 4.7.16
 * @author iOS:姚曦 , Android:几米
 */
export declare function unbindTaobao$(params: IInternalUserUnbindTaobaoParams): Promise<IInternalUserUnbindTaobaoResult>;
export default unbindTaobao$;
