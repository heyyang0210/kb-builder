Created by 高风朴, last modified on 六月 10, 2023

## 1. Overview（概述）

YFS通过直接管理裸设备，对业务侧，提供类文件系统接口。业务侧可通过类似文件系统命令访问裸设备。

## 2. Features（功能特性）

YFS可以在物理机，虚拟机运行。

YFS可以直接访问裸设备。目前仅支持一块盘。多块盘的多dg，多fg模式正在开发中。

YFS管理的裸设备，大小受AU size限制。具体算法为AUSize*2^32. 当AUSize为1M时，裸设备最大值为1M*2^32=4PB。最小为4个AU大小。即4M

## 3. Interfaces（接口）

yfs提供基本的创建/删除文件目录，读写文件等接口。具体接口如下：

```
CodResult yfsMakeDir(YfsHandler* handler, CodText* path);
CodResult yfsRemoveDir(YfsHandler* handler, CodText* fullPathName);
CodResult yfsGetEntryCnt(YfsHandler* handler, CodText* fullPath, CodUint32* count);
CodResult yfsGetEntryPaging(YfsHandler* handler, CodText* path, YfsDirEntry* entry, CodUint32 start, CodUint32 count, CodUint32 totalCount);
CodResult yfsStat(YfsHandler* handler, CodText* path, YfsStat* stat);
CodResult yfsFdStat(YfsHandler* handler, CodUint32 fd, YfsStat* stat);
CodResult yfsRename(YfsHandler* handler, CodText* oldName, CodText* newName);
CodResult yfsCreateFile(YfsHandler* handler, CodText* path, YfsFd* fd);
CodResult yfsRemoveFile(YfsHandler* handler, CodText* fullPathName);
CodResult yfsOpenFile(YfsHandler* handler, CodText* fullPathName, YfsFd* fd);
CodResult yfsWriteFile(YfsHandler* handler, YfsFd fd, CodUint64 offset, const CodChar* buff, CodUint32 size);
CodResult yfsReadFile(YfsHandler* handler, YfsFd fd, CodUint64 offset, CodChar* buff, CodUint32 size,
                      yfsVerifyCallback verify);
```

## 4. Limitations（功能限制）

当前转测版本：

yfs仅支持单机。yfs已经对接了yfscmd测试。可以用yfscmd做测试。

删除文件时，文件资源没有做回收。

所有YFS都运行在linux上。不支持windows

## 5. Detail Design（详细设计）

详见    [YFS 模块详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109579258)     

## 6. Testcases（用例）

  


|场景|前置|预期|
|---|---|---|
|服务拉起|正确配置|服务正常拉起|
|创建文件,目录|服务拉起|正常创建文件目录，且服务关闭后再次拉起，文件，目录已经存在|
|删除文件，目录|文件，目录已经创建|删除文件，目录成功，且服务关闭后再次拉起，不能看到已经删除的文件目录。|
|正常扩展文件|文件已经创建|extend后，文件可正常读写。查看文件size正确。|
|文件做truncate|文件被extend过|truncate后，文件size正确。|


## 7. Workload（工作量）

## 8. TODO（遗留问题）

  
