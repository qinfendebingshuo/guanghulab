export declare const apiName = "internal.circle.removeStorage";
/**
 * 删除圈子native-小程序共享业务缓存 请求参数定义
 * @apiName internal.circle.removeStorage
 */
export interface IInternalCircleRemoveStorageParams {
    /** 缓存业务类型 */
    bizType: string;
    /** 缓存数据的key */
    key: string;
}
/**
 * 删除圈子native-小程序共享业务缓存 返回结果定义
 * @apiName internal.circle.removeStorage
 */
export interface IInternalCircleRemoveStorageResult {
}
/**
 * 删除圈子native-小程序共享业务缓存
 * @apiName internal.circle.removeStorage
 * @supportVersion ios: 6.0.12 android: 6.0.12
 * @author android：千下；ios：子理
 */
export declare function removeStorage$(params: IInternalCircleRemoveStorageParams): Promise<IInternalCircleRemoveStorageResult>;
export default removeStorage$;
