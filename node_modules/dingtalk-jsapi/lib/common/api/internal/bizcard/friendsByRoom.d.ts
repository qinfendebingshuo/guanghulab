export declare const apiName = "internal.bizcard.friendsByRoom";
/**
 * 根据room获取房间内好友列表 请求参数定义
 * @apiName internal.bizcard.friendsByRoom
 */
export interface IInternalBizcardFriendsByRoomParams {
    roomId: number;
    offset: number;
    size: number;
}
/**
 * 根据room获取房间内好友列表 返回结果定义
 * @apiName internal.bizcard.friendsByRoom
 */
export interface IInternalBizcardFriendsByRoomResult {
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
 * 根据room获取房间内好友列表
 * @apiName internal.bizcard.friendsByRoom
 * @supportVersion ios: 4.5.17 android: 4.5.17
 */
export declare function friendsByRoom$(params: IInternalBizcardFriendsByRoomParams): Promise<IInternalBizcardFriendsByRoomResult>;
export default friendsByRoom$;
