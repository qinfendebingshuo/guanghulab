export declare const apiName = "internal.chat.batchUserProfiles";
/**
 * 根据openIds批量获取对应的profiles 请求参数定义
 * @apiName internal.chat.batchUserProfiles
 */
export interface IInternalChatBatchUserProfilesParams {
    openIds: number[];
}
/**
 * 根据openIds批量获取对应的profiles 返回结果定义
 * @apiName internal.chat.batchUserProfiles
 */
export interface IInternalChatBatchUserProfilesResult {
    userProfiles: any;
}
/**
 * 根据openIds批量获取对应的profiles
 * @apiName internal.chat.batchUserProfiles
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function batchUserProfiles$(params: IInternalChatBatchUserProfilesParams): Promise<IInternalChatBatchUserProfilesResult>;
export default batchUserProfiles$;
