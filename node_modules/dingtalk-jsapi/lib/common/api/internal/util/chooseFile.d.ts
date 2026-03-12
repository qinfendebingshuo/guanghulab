export declare const apiName = "internal.util.chooseFile";
/**
 * 选择本地文件，返回其虚拟路径 请求参数定义
 * @apiName internal.util.chooseFile
 */
export interface IInternalUtilChooseFileParams {
    /**
     * 最多可以选择的文件个数，取值范围[1,9]
     * multiSelection 专有钉独有 是否多选，默认单选，iOS11及以上才支持多选
     */
    count: number;
    multiSelection?: boolean;
}
/**
 * 选择本地文件，返回其虚拟路径 返回结果定义
 * @apiName internal.util.chooseFile
 */
export interface IInternalUtilChooseFileResult {
    files: Array<{
        path: string;
        size: number;
        name: string;
    }>;
}
/**
 * 选择本地文件，返回其虚拟路径
 * @apiName internal.util.chooseFile
 * @supportVersion ios: 4.7.12 android: 4.7.12
 * @author Android:泠轩 ; iOS: 贾逵
 */
export declare function chooseFile$(params: IInternalUtilChooseFileParams): Promise<IInternalUtilChooseFileResult>;
export default chooseFile$;
