import { ICommonAPIParams } from '../../constant/types';
/**
 * 地图页面支持搜索 请求参数定义
 * @apiName searchMap
 */
export interface IUnionSearchMapParams extends ICommonAPIParams {
    scope: number;
    latitude: number;
    longitude: number;
}
/**
 * 地图页面支持搜索 返回结果定义
 * @apiName searchMap
 */
export interface IUnionSearchMapResult {
    city: string;
    title: string;
    adCode: string;
    adName: string;
    snippet: string;
    cityCode: string;
    distance: string;
    latitude: number;
    postCode: string;
    province: string;
    longitude: string;
    provinceCode: string;
}
/**
 * 地图页面支持搜索
 * @apiName searchMap
 */
export declare function searchMap$(params: IUnionSearchMapParams): Promise<IUnionSearchMapResult>;
export default searchMap$;
