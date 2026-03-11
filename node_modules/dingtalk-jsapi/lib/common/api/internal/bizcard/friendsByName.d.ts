export declare const apiName = "internal.bizcard.friendsByName";
/**
 * 按名字获取好友列表 请求参数定义
 * @apiName internal.bizcard.friendsByName
 */
export interface IInternalBizcardFriendsByNameParams {
    offset: number;
    size: number;
}
/**
 * 按名字获取好友列表 返回结果定义
 * @apiName internal.bizcard.friendsByName
 */
export interface IInternalBizcardFriendsByNameResult {
    data: {
        list: Array<{
            uid: any;
            avatarMediaId: any;
            name: any;
            title: any;
            orgId: any;
            orgName: any;
            address: any;
            orgAuthed: any;
            titleAuthed: any;
            nameAuthed: any;
            roomId: any;
            location: any;
            tags: any;
            remark: any;
            gmtCreate: any;
            nickPinyin: any;
        }>;
        offset: number;
        hasMore: boolean;
    };
}
/**
 * 按名字获取好友列表
 * @apiName internal.bizcard.friendsByName
 * @supportVersion ios: 4.5.17 android: 4.5.17
 */
export declare function friendsByName$(params: IInternalBizcardFriendsByNameParams): Promise<IInternalBizcardFriendsByNameResult>;
export default friendsByName$;
