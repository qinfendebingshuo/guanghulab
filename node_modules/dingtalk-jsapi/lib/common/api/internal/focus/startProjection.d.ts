export declare const apiName = "internal.focus.startProjection";
/**
 * 开始投屏 请求参数定义
 * @apiName internal.focus.startProjection
 */
export interface IInternalFocusStartProjectionParams {
    /** 'local' | 'meeting' */
    type: string;
    /** '720p' | '1080p' */
    clarity: string;
    code?: string;
    uids?: {
        users: string[];
        devices: string[];
    };
}
/**
 * 开始投屏 返回结果定义
 * @apiName internal.focus.startProjection
 */
export interface IInternalFocusStartProjectionResult {
}
/**
 * 开始投屏
 * @apiName internal.focus.startProjection
 * @supportVersion android: 4.7.23
 * @author android: 柳樵, ios: 见招
 */
export declare function startProjection$(params: IInternalFocusStartProjectionParams): Promise<IInternalFocusStartProjectionResult>;
export default startProjection$;
