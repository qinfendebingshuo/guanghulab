import { ICommonAPIParams } from '../../constant/types';
/**
 * DING 2.0 发钉 请求参数定义
 * @apiName createDing
 */
export interface IUnionCreateDingParams extends ICommonAPIParams {
    text?: string;
    type?: number;
    users: string[];
    corpId?: string;
    confInfo?: {
        endTime: {
            value: string;
            format: string;
        };
        location: string;
        startTime: {
            value: string;
            format: string;
        };
        bizSubType: number;
        remindType: number;
        remindMinutes: number;
    };
    taskInfo?: {
        ccUsers: string;
        taskRemind: number;
        deadlineTime: {
            value?: string;
            format?: string;
        };
    };
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
 * DING 2.0 发钉 返回结果定义
 * @apiName createDing
 */
export interface IUnionCreateDingResult {
}
/**
 * DING 2.0 发钉
 * @apiName createDing
 */
export declare function createDing$(params: IUnionCreateDingParams): Promise<IUnionCreateDingResult>;
export default createDing$;
