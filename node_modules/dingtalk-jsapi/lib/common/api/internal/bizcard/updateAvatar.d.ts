export declare const apiName = "internal.bizcard.updateAvatar";
/**
 * 前端更新头像，通知客户端 请求参数定义
 * @apiName internal.bizcard.updateAvatar
 */
export interface IInternalBizcardUpdateAvatarParams {
    url: string;
}
/**
 * 前端更新头像，通知客户端 返回结果定义
 * @apiName internal.bizcard.updateAvatar
 */
export interface IInternalBizcardUpdateAvatarResult {
}
/**
 * 前端更新头像，通知客户端
 * @apiName internal.bizcard.updateAvatar
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function updateAvatar$(params: IInternalBizcardUpdateAvatarParams): Promise<IInternalBizcardUpdateAvatarResult>;
export default updateAvatar$;
