export declare const apiName = "internal.bizcard.friendCount";
/**
 * 获取好友总数或房间内好友总数 请求参数定义
 * @apiName internal.bizcard.friendCount
 */
export interface IInternalBizcardFriendCountParams {
    roomId: number;
}
/**
 * 获取好友总数或房间内好友总数 返回结果定义
 * @apiName internal.bizcard.friendCount
 */
export interface IInternalBizcardFriendCountResult {
    data: number;
}
/**
 * 获取好友总数或房间内好友总数
 * @apiName internal.bizcard.friendCount
 * @supportVersion ios: 4.5.17 android: 4.5.17
 */
export declare function friendCount$(params: IInternalBizcardFriendCountParams): Promise<IInternalBizcardFriendCountResult>;
export default friendCount$;
