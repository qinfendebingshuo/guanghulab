export declare const apiName = "internal.cspace.downloadFile";
/**
 * 下载钉盘文件并且返回H5可访问的url 请求参数定义
 * @apiName internal.cspace.downloadFile
 */
export interface IInternalCspaceDownloadFileParams {
    spaceId: string;
    fileId: string;
    /** 文件版本 */
    dentryVersion?: number;
    /** 默认用缓存 */
    useCacheIfAny?: boolean;
}
/**
 * 下载钉盘文件并且返回H5可访问的url 返回结果定义
 * @apiName internal.cspace.downloadFile
 */
export interface IInternalCspaceDownloadFileResult {
    /** 一个可访问本地文件的url 如：http://loc.dingtalk.com/QzpcVXNlcnNcQWRtaW5pc3RyYXRvclxBcHBEYXRhXExvY2FsXFRlbXBcNjVBQi50bXA= */
    resource_url: string;
}
/**
 * 下载钉盘文件并且返回H5可访问的url
 * @apiName internal.cspace.downloadFile
 * @supportVersion ios: 5.1.9 android: 5.1.9 ios: 5.1.14
 * @author windows: 伏檀 mac：口合 iOS: 星楼
 */
export declare function downloadFile$(params: IInternalCspaceDownloadFileParams): Promise<IInternalCspaceDownloadFileResult>;
export default downloadFile$;
