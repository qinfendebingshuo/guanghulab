export declare const apiName = "internal.studyroom.initRoom";
/**
 * 初始化学习房间 请求参数定义
 * @apiName internal.studyroom.initRoom
 */
export interface IInternalStudyroomInitRoomParams {
    /** 会话id */
    cid: string;
    /** 前端获取服务端的互动房间模型 */
    room: any;
}
/**
 * 初始化学习房间 返回结果定义
 * @apiName internal.studyroom.initRoom
 */
export interface IInternalStudyroomInitRoomResult {
    /** 客户端进行中的房间模型  */
    room: any;
}
/**
 * 初始化学习房间
 * @apiName internal.studyroom.initRoom
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function initRoom$(params: IInternalStudyroomInitRoomParams): Promise<IInternalStudyroomInitRoomResult>;
export default initRoom$;
