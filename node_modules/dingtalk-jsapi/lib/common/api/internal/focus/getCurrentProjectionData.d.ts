export declare const apiName = "internal.focus.getCurrentProjectionData";
/**
 * 获取当前投屏状态 请求参数定义
 * @apiName internal.focus.getCurrentProjectionData
 */
export interface IInternalFocusGetCurrentProjectionDataParams {
}
interface IMember {
    name: string;
    uid: string;
    avatar?: string;
}
interface IProjectionStatus {
    currentType: 'local' | 'meeting';
    localStatus: 'idle' | 'processing' | 'started';
    meetingStatus: 'idle' | 'processing' | 'started';
}
/**
 * 获取当前投屏状态 返回结果定义
 * @apiName internal.focus.getCurrentProjectionData
 */
export interface IInternalFocusGetCurrentProjectionDataResult {
    /** 投屏状态数据 */
    status: IProjectionStatus;
    /** 投屏码 */
    code?: string;
    /** 当前用户信息 */
    currentUser?: IMember;
    /** 投屏成员信息 */
    memberInfo?: {
        users: IMember[];
        devices: IMember[];
    };
}
/**
 * 获取当前投屏状态
 * @apiName internal.focus.getCurrentProjectionData
 * @supportVersion android: 4.7.23
 * @author 安卓：柳樵，战杭， ios：见招
 */
export declare function getCurrentProjectionData$(params: IInternalFocusGetCurrentProjectionDataParams): Promise<IInternalFocusGetCurrentProjectionDataResult>;
export default getCurrentProjectionData$;
