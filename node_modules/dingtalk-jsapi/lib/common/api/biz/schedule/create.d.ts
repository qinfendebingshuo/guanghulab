export declare const apiName = "biz.schedule.create";
/**
 * 创建日程 请求参数定义
 * @apiName biz.schedule.create
 */
export interface IBizScheduleCreateParams {
    [key: string]: any;
}
/**
 * 创建日程 返回结果定义
 * @apiName biz.schedule.create
 */
export interface IBizScheduleCreateResult {
    [key: string]: any;
}
/**
 * 创建日程
 * @apiName biz.schedule.create
 * @supportVersion  ios: 4.2 android: 4.2
 */
export declare function create$(params: IBizScheduleCreateParams): Promise<IBizScheduleCreateResult>;
export default create$;
