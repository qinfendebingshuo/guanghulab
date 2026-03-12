import { ICommonAPIParams } from '../../constant/types';
/**
 * DING 1.0 发钉 请求参数定义
 * @apiName createDingForPC
 */
export interface IUnionCreateDingForPCParams extends ICommonAPIParams {
    text?: string;
    type?: number;
    users: string[];
    corpId: string;
    alertDate?: {
        value: string;
        format: string;
    };
    alertType?: number;
    attachment?: {
        images: string[];
    };
}
/**
 * DING 1.0 发钉 返回结果定义
 * @apiName createDingForPC
 */
export interface IUnionCreateDingForPCResult {
}
/**
 * DING 1.0 发钉
 * @apiName createDingForPC
 */
export declare function createDingForPC$(params: IUnionCreateDingForPCParams): Promise<IUnionCreateDingForPCResult>;
export default createDingForPC$;
