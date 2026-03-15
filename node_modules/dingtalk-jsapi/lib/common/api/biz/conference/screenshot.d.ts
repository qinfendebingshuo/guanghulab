export declare const apiName = "biz.conference.screenshot";
/**
 * 获取当前进行中会议的窗口截图 请求参数定义
 * @apiName biz.conference.screenshot
 */
export interface IBizConferenceScreenshotParams {
    /** 水印内容 | 非必填 | 默认无水印  */
    watermarkText?: string;
    /** 水印输出位置，以九宫格表示区域划分，1为左上，6为右中，以此类推 | 非必填 | 默认 7(左下位置) */
    watermarkPositon?: number;
    /** jpg / png | 非必填 | 默认 jpg */
    imageFormat?: string;
    /**  jpg的图片质量, 取值1到100 | 非必填 | 默认 75 */
    quality?: number;
    /**  图片的最大宽度.过大将被等比缩小 | 非必填 | 默认无限制 */
    maxWidth?: number;
    /** 图片的最大高度.过大将被等比缩小 | 非必填 | 默认无限制 */
    maxHeight?: number;
    /** 水印文字的颜色，用 0xaarrggbb 格式来表示颜色对应的 argb 值 | 非必填 | 默认 0xffffffff (白色) */
    watermarkColor?: string;
}
/**
 * 获取当前进行中会议的窗口截图 返回结果定义
 * @apiName biz.conference.screenshot
 */
export interface IBizConferenceScreenshotResult {
    /** 截图的路径（虚拟路径） */
    filePath: string;
}
/**
 * 获取当前进行中会议的窗口截图
 * @apiName biz.conference.screenshot
 * @supportVersion ios: 4.6.40 android: 4.6.40
 */
export declare function screenshot$(params: IBizConferenceScreenshotParams): Promise<IBizConferenceScreenshotResult>;
export default screenshot$;
