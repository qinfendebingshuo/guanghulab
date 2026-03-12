export declare const apiName = "internal.circle.setStorage";
/**
 * 设置圈子native-小程序共享业务缓存 请求参数定义
 * @apiName internal.circle.setStorage
 */
export interface IInternalCircleSetStorageParams {
    /** 缓存业务类型 */
    bizType: string;
    /** 缓存数据的key */
    key: string;
    /** 缓存的数据 */
    data: string;
}
/**
 * 设置圈子native-小程序共享业务缓存 返回结果定义
 * @apiName internal.circle.setStorage
 */
export interface IInternalCircleSetStorageResult {
}
/**
 * 设置圈子native-小程序共享业务缓存
 * @apiName internal.circle.setStorage
 * @supportVersion ios: 6.0.12 android: 6.0.12
 * @author android：千下；ios：子理
 */
export declare function setStorage$(params: IInternalCircleSetStorageParams): Promise<IInternalCircleSetStorageResult>;
export default setStorage$;
