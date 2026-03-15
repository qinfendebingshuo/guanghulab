export declare const apiName = "internal.bizcard.friendsByCategory";
/**
 * 根据具体分类值获取指定分类好友列表 请求参数定义
 * @apiName internal.bizcard.friendsByCategory
 */
export interface IInternalBizcardFriendsByCategoryParams {
    /** '21001' 或 '设计师' 或 '朋友' */
    categoryValue: string;
    /** 'tag', 'org', 'title' */
    category: string;
    offset: number;
    size: number;
}
/**
 * 根据具体分类值获取指定分类好友列表 返回结果定义
 * @apiName internal.bizcard.friendsByCategory
 */
export interface IInternalBizcardFriendsByCategoryResult {
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
 * 根据具体分类值获取指定分类好友列表
 * @apiName internal.bizcard.friendsByCategory
 * @supportVersion ios: 4.5.17 android: 4.5.17
 */
export declare function friendsByCategory$(params: IInternalBizcardFriendsByCategoryParams): Promise<IInternalBizcardFriendsByCategoryResult>;
export default friendsByCategory$;
