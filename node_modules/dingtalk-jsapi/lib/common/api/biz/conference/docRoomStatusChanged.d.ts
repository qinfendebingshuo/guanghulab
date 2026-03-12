export declare const apiName = "biz.conference.docRoomStatusChanged";
/**
 * 更新文档房间属性 请求参数定义
 * @apiName biz.conference.docRoomStatusChanged
 */
export interface IBizConferenceDocRoomStatusChangedParams {
    is_following: boolean;
    presenter_uid: boolean;
}
/**
 * 更新文档房间属性 返回结果定义
 * @apiName biz.conference.docRoomStatusChanged
 */
export interface IBizConferenceDocRoomStatusChangedResult {
    data: any;
}
/**
 * 更新文档房间属性
 * @apiName biz.conference.docRoomStatusChanged
 * @supportVersion ios: 6.0.19 android: 6.0.17
 * @author Android：@风纭, iOS：@蒙歌
 */
export declare function docRoomStatusChanged$(params: IBizConferenceDocRoomStatusChangedParams): Promise<IBizConferenceDocRoomStatusChangedResult>;
export default docRoomStatusChanged$;
