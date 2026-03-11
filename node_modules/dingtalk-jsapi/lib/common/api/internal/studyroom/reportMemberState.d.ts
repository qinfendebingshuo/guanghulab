export declare const apiName = "internal.studyroom.reportMemberState";
/**
 * 同步学习室成员状态 请求参数定义
 * @apiName internal.studyroom.reportMemberState
 */
export interface IInternalStudyroomReportMemberStateParams {
    /** 房间id */
    roomId: string;
    /** 房间关联实体id，这里是会话id */
    entityId: string;
    /** 房主id */
    ownerId: number;
    /** 成员列表 */
    members: any[];
}
/**
 * 同步学习室成员状态 返回结果定义
 * @apiName internal.studyroom.reportMemberState
 */
export interface IInternalStudyroomReportMemberStateResult {
}
/**
 * 同步学习室成员状态
 * @apiName internal.studyroom.reportMemberState
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function reportMemberState$(params: IInternalStudyroomReportMemberStateParams): Promise<IInternalStudyroomReportMemberStateResult>;
export default reportMemberState$;
