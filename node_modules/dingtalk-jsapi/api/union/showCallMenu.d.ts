import { ICommonAPIParams } from '../../constant/types';
/**
 * 唤起拨打电话菜单 请求参数定义
 * @apiName showCallMenu
 */
export interface IUnionShowCallMenuParams extends ICommonAPIParams {
    code: string;
    phoneNumber: string;
    showDingCall?: boolean;
}
/**
 * 唤起拨打电话菜单 返回结果定义
 * @apiName showCallMenu
 */
export interface IUnionShowCallMenuResult {
}
/**
 * 唤起拨打电话菜单
 * @apiName showCallMenu
 */
export declare function showCallMenu$(params: IUnionShowCallMenuParams): Promise<IUnionShowCallMenuResult>;
export default showCallMenu$;
