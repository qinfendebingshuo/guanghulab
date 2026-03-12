export declare const apiName = "internal.cache.restore";
/**
 * 还原javascript环境上下文信息以及客户端crash时保存的上下信息 请求参数定义
 * @apiName internal.cache.restore
 */
export interface IInternalCacheRestoreParams {
    /** 类型，比如人脸打卡为：FaceAttendance */
    bizType: string;
    /** 企业id */
    corpId: string;
}
/**
 * 还原javascript环境上下文信息以及客户端crash时保存的上下信息 返回结果定义
 * @apiName internal.cache.restore
 */
export interface IInternalCacheRestoreResult {
    /** 原样返回 */
    data: string;
    /** 原样返回 */
    bizType: string;
    /** 原样返回 */
    corpId: string;
    /** 附加数据 */
    extData: any;
}
/**
 * 还原javascript环境上下文信息以及客户端crash时保存的上下信息
 * @apiName internal.cache.restore
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function restore$(params: IInternalCacheRestoreParams): Promise<IInternalCacheRestoreResult>;
export default restore$;
