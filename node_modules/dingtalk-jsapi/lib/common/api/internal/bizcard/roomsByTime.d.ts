export declare const apiName = "internal.bizcard.roomsByTime";
/**
 * 按面对面获取房间列表 请求参数定义
 * @apiName internal.bizcard.roomsByTime
 */
export interface IInternalBizcardRoomsByTimeParams {
    [key: string]: any;
}
/**
 * 按面对面获取房间列表 返回结果定义
 * @apiName internal.bizcard.roomsByTime
 */
export interface IInternalBizcardRoomsByTimeResult {
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
        roomId: number;
        location: string;
        date: string;
        time: string;
        count: number;
    };
}
/**
 * 按面对面获取房间列表
 * @apiName internal.bizcard.roomsByTime
 * @supportVersion ios: 4.5.17 android: 4.5.17
 */
export declare function roomsByTime$(params: IInternalBizcardRoomsByTimeParams): Promise<IInternalBizcardRoomsByTimeResult>;
export default roomsByTime$;
