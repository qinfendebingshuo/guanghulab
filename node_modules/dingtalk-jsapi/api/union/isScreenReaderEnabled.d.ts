import { ICommonAPIParams } from '../../constant/types';
/**
 * 是否开启无障碍模式 请求参数定义
 * @apiName isScreenReaderEnabled
 */
export interface IUnionIsScreenReaderEnabledParams extends ICommonAPIParams {
}
/**
 * 是否开启无障碍模式 返回结果定义
 * @apiName isScreenReaderEnabled
 */
export interface IUnionIsScreenReaderEnabledResult {
    screenReaderEnabled: boolean;
}
/**
 * 是否开启无障碍模式
 * @apiName isScreenReaderEnabled
 */
export declare function isScreenReaderEnabled$(params: IUnionIsScreenReaderEnabledParams): Promise<IUnionIsScreenReaderEnabledResult>;
export default isScreenReaderEnabled$;
