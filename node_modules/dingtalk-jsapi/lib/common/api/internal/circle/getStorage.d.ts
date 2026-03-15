export declare const apiName = "internal.circle.getStorage";
/**
 * 删除圈子native-获取圈子业务缓存 请求参数定义
 * @apiName internal.circle.getStorage
 */
export interface IInternalCircleGetStorageParams {
    /** 缓存业务类型 */
    bizType: string;
    /** 缓存数据的key */
    key: string;
}
/**
 * 删除圈子native-获取圈子业务缓存 返回结果定义
 * @apiName internal.circle.getStorage
 */
export declare type IInternalCircleGetStorageResult = string;
/**
 * 删除圈子native-获取圈子业务缓存
 * @apiName internal.circle.getStorage
 * @supportVersion ios: 6.0.12 android: 6.0.12
 * @author android：千下；ios：子理
 */
export declare function getStorage$(params: IInternalCircleGetStorageParams): Promise<IInternalCircleGetStorageResult>;
export default getStorage$;
