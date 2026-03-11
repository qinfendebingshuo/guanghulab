import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取用户当前的地理位置信息 请求参数定义
 * @apiName getLocation
 */
export interface IUnionGetLocationParams extends ICommonAPIParams {
    type: number;
    useCache: boolean;
    coordinate: string;
    cacheTimeout: number;
    withReGeocode: boolean;
    targetAccuracy: string;
}
/**
 * 获取用户当前的地理位置信息 返回结果定义
 * @apiName getLocation
 */
export interface IUnionGetLocationResult {
    city: string;
    address: string;
    accuracy: string;
    latitude: string;
    province: string;
    longitude: string;
}
/**
 * 获取用户当前的地理位置信息
 * @apiName getLocation
 */
export declare function getLocation$(params: IUnionGetLocationParams): Promise<IUnionGetLocationResult>;
export default getLocation$;
