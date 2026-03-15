export declare const apiName = "internal.cache.save";
/**
 * 保存javascript环境上下文信息 请求参数定义
 * @apiName internal.cache.save
 */
export interface IInternalCacheSaveParams {
    /** 需要存储的数据，数据内容由业务自定义，调用恢复接口（restore）时原样返回 */
    data: any;
    /** 企业id */
    corpId: string;
    /** 业务类型，比如人脸打卡约定为：FaceAttendance */
    bizType: string;
}
/**
 * 保存javascript环境上下文信息 返回结果定义
 * @apiName internal.cache.save
 */
export interface IInternalCacheSaveResult {
}
/**
 * 保存javascript环境上下文信息
 * @apiName internal.cache.save
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function save$(params: IInternalCacheSaveParams): Promise<IInternalCacheSaveResult>;
export default save$;
