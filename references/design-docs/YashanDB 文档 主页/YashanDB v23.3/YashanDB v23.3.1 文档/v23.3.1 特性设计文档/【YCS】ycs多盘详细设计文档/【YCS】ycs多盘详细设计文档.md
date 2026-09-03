Created by 李垠, last modified on 十一月 08, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    *?*    
  *#YASHAN-305 YCS支持多盘，支持YFS管理YCS数据*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611a8b7579a3edb84d860f1](https://pingcode.yasdb.com/pjm/items/6611a8b7579a3edb84d860f1)    *?*    
  *#YDBRD-25870 YCS支持多盘——YCS*

##   [1. 总述](#1-总述)  

详见概要设计文档   [【YCS】YFS管理下实现ycs多盘概要设计](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67396e20593f99c9ff238252)  

###   [1.1 需求来源](#11-需求来源)  

部署形态：共享集群

内部需求，提高集群产品对外竞争力。

###   [1.2 调研文档](#12-调研文档)  

ASM支持OCR和VF调研文档     [https://conf.yasdb.com/pages/viewpage.action?pageId=147770440](https://conf.yasdb.com/pages/viewpage.action?pageId=147770440)  

参考文献： 《Oracle RAC 核心技术详解》

YFS 部分设计文档：   [ycs 支持 yfs 详细设计---YFS 支持 system DG](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673975ed728206efb92f63a6)  

###   [1.3 需求分析](#13-需求分析)  

本方案是将多盘放入yfs管理，带来的收益是

1）利用yfs的冗余和条带化

2）方便演进

3）提升系统稳定性，即：当某个节点不能访问磁盘时，将对应的盘离线，而不需要进行集群重构，只有当不能访问的磁盘满足一定数量时，才会触发集群重构

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|**yfs磁盘发现能力**|详见yfs设计文档|是/否|是/否|
||**yfs读写ycs、ycr文件能力**|详见yfs设计文档|是/否|是/否|
||ycr、ycs获取ycs、ycr文件名称的能力|1、支持默认名称，可以不配置文件名称；2、yascs.ini新增配置项   **YCR_FILE_NAME**  ，   **VOTING_FILE_NAME**  ，用于配置voting file和ycr file名称|是/否|是/否|
||ycs启动|1、yfs以备角色启动，提供文件读写能力；2、ycs再启动|是/否|是/否|
||ycs停止|停止yfs时，保留ycs、ycr文件的读写能力，待ycs停止后，yfs再完全停止|是/否|是/否|
|兼容性|从单盘升级到多盘的能力|1、先导出ycr配置；2、新包替换旧包；3、导入ycr|是/否|是/否|
|可靠性|**yfs对于多个voting file、ycs file副本的一致性处理以及恢复**|详见yfs设计文档|是/否|是/否|
||故障场景下的ycs重启|大体上就是ycs停止、ycs启动流程，注意整个过程yfs保持读写ycr file、voting file的能力|是/否|是/否|
|可维可测|**yfs提供某副本损坏的故障点**|详见yfs设计文档|是/否|是/否|
||ycs提供各个启动、停止各个阶段失败的故障点|----|是/否|是/否|
|易用性|**yfs展示多盘状态、路径、组名**|----|是/否|是/否|
||ycs展示多盘状态、路径、组名|----|是/否|是/否|
|周边配合|**om适配部署流程**|详见om的设计文档|----|是/否|
|周边配合|**om适配升级流程**|详见om的设计文档|----|是/否|
|性能|要求性能不劣化|----|----|是/否|
||不影响RTO|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

无。

###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|函数|**yfs**   打开文件接口，输入：voting file/ycr file名称， 输出：文件fd|ycrFd = yfsiOpenFile("+system/ycr");|是|
||**yfs**   关闭文件接口，yfsiCloseFile(conn, ycrFd)|----|是|
||**yfs**   读文件接口，yfsiReadYcsFile(conn, ycrFd, buffer, offset, len)|1、yfs处理半读问题， yfs考虑这种算法：记录原始crc，多次循环如果不变，证明是有损坏，可以直接报错，如果变化，则说明其他节点正在写入，需要等待到超时时间；2、yfs要解决多副本一致性问题，采用多数派原则，ycs负责提供回调函数，增加版本号；3、yfs负责解决损坏的副本恢复的问题 ；4、(VF盘数/2 )+ 1 或者以上的数量的表决盘损坏时，报错|是|
||**yfs**   写文件接口，yfsiWriteYcsFile(conn, ycrFd, buffer, offset, len)|----|是|
||版本号生成接口|yfs使用版本号判断应该使用哪个副本|是|
||**yfs**   yfs对表决盘数量的合法性校验|仅支持1、3、5块表决盘，其他数量不支持，报错；此接口在yfs启动时调用|是|
||**yfs**   yfs两阶段的停止接口|1、停止除了voting file和ycr file外的其他线程；2、完全停止yfs；3、兼容单盘|是|
||**yfs**   启动接口yfsStartSysDg 、yfsStartResource|多盘启动接口，兼容单盘启动接口|是|
||ycsctl show config 中需要展示ycr file和voting file的名字、磁盘模式|多盘启动接口，兼容单盘启动接口|是|
|配置参数|YCR_FILE_NAME：ycr文件名称；VOTING_FILE_NAME:voting disk文件名称；这两个参数一旦设置了就不能修改，除非重新部署集群，重建两个文件|----|是|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

**1) 不兼容原来的裸盘模式**

**2) 支持三种冗余度，分别是外部冗余，普通冗余和高冗余。配置一块磁盘，属于外部冗余，建议选择自身可以实提供冗余保护的硬件设备。普通冗余支持配置3块磁盘，高冗余支持配置5块磁盘。其他数量的磁盘不支持。**

**3) (VF盘数/2 )+ 1 或者以上的数量的表决盘损坏时，集群启动失败**

**4) 暂时不支持动态增加或者删除表决盘**

**5) 部署时不支持并发**

##   [4. 特性](#4-特性)  

###   [4.1 YCR部署](#41-ycr部署)  

yfssrv服务提供磁盘发现、创建、读写voting file、ycr file功能，在部署阶段完成磁盘发先、磁盘组创建和文件创建。

**OM按照图示流程进行适配。**

![](https://pingcode.yasdb.com/atlas/files/public/67396ecca1ad9a3311dc99fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBRUFBQUFBQUFFQUFBQUFBQUFBQUFDQUFBQUlBQUFBQVFBQUFBQUFBQVFBQUFCQUFBQUFBQUlDQUlBQUFBQUFnQUFBQVFBQUFBQUFBQkFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzcsImV4cCI6MTc4MjQ0OTc3N30.vGVFAZ12Mfy1jioKzvbYI-xHeRlC_o1xTWc821oHd0g)

**1) ycr部署时，需要知道voting file、ycr file文件名，才能进行读写操作，采用默认值和传入参数的方法支持该参数。**

**2) yascs.ini中新增配置项VOTING_FILE_NAME、YCR_FILE_NAME，用于配置两个文件的名字，此配置项不是必须，如果没有配置，默认的文件名字为+system/ycr、+system/voting**

**3) ycsctl create cluster yascluster -o 命令中的-ycsdisk删除**

部署流程演示：

1)启动YFS实例（包含磁盘发现）

```
yasfs --diskstring=/dev/yfs 

```

2)初始化diskgroup

```
yfscmd create system diskgroup system ... sdc

```

3)初始化YCR配置

```
yfscmd touch "+system/voting";
yfscmd truncate -s 100M +system/voting;
yfscmd touch "+system/ycr";
yfscmd truncate -s 100M +system/ycr;

ycsctl create cluster yascluster -o
...

```

1. 停止yfs实例


```
yasfs stop

```

###   [4.2 启动](#42-启动)  

yfs启动分两个阶段，第一阶段yfs启动为保护模式，第二阶段完成备升主

1. ycs主线程启动
1. 启动yfs到保护模式（  **yfsStartSysDg**  ）
1. ycs读取ycr配置，并进行其他初始化工作
1. ycs选主，完成启动（此时如果收到备节点加入请求，返回失败）
1. 启动线程，线程启动yfsStartResource，此时ycs不会等待yfs启动成功，直接进入工作模式，即可以处理异常和其他命令
1. yfs启动完成后，启动yasdb。  **注意yasdb也需要读写voting file，ycs需要将fd传给yasdb**


![](https://pingcode.yasdb.com/atlas/files/public/67396ecca1ad9a3311dc99fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBRUFBQUFBQUFFQUFBQUFBQUFBQUFDQUFBQUlBQUFBQVFBQUFBQUFBQVFBQUFCQUFBQUFBQUlDQUlBQUFBQUFnQUFBQVFBQUFBQUFBQkFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzcsImV4cCI6MTc4MjQ0OTc3N30.vGVFAZ12Mfy1jioKzvbYI-xHeRlC_o1xTWc821oHd0g)

写盘时，ycs文件每个block写入version，ycr文件整体写入一个version，类型是CodUint64，yfs的数据一致性算法需要满足如下要求：

**非crc和副本错误，yfs返回失败，ycs自杀**

**yfs的读接口，返回值中携带”crc/副本错误“的节点号**

**保留多数派原则版本一致，返回成功，比如读到版本 2 1 1返回1，读到版本2 2 1，返回2**

**写接口改为：要求多数派写成功返回成功，否则返回失败**

**不需要修复损坏的block**

###   [4.3 并发停止ycs](#43-并发停止ycs)  

yfs停止分两个阶段，第一阶段先停止除了文件读写功能的其他线程，第二阶段停止文件读写功能。

停止yfs的流程先调用yfsStopResource，最后再调用yfsStopSysDg

![](https://pingcode.yasdb.com/atlas/files/public/67396ecc8970c2af4f521b8e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBRUFBQUFBQUFFQUFBQUFBQUFBQUFDQUFBQUlBQUFBQVFBQUFBQUFBQVFBQUFCQUFBQUFBQUlDQUlBQUFBQUFnQUFBQVFBQUFBQUFBQkFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzcsImV4cCI6MTc4MjQ0OTc3N30.vGVFAZ12Mfy1jioKzvbYI-xHeRlC_o1xTWc821oHd0g)

###   [4.4 故障场景](#44-故障场景)  

ycs启动完成后，才具备故障处理能力，ycs处理故障的方式是主驱逐备，或者投票重新选主，整个故障处理过程中，对读写voting file能力要求如下：

1）yfs发现自己不是主、或者db发现ycs被驱逐，能够读写voting file

2）整个故障处理过程中，不论yfs主处于何种状态，能够读写voting file

3）被驱逐的节点，进入重启流程后，能够读写voting file

下图是yfs master的状态图

![](https://pingcode.yasdb.com/atlas/files/public/67396ecca1ad9a3311dc99fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBRUFBQUFBQUFFQUFBQUFBQUFBQUFDQUFBQUlBQUFBQVFBQUFBQUFBQVFBQUFCQUFBQUFBQUlDQUlBQUFBQUFnQUFBQVFBQUFBQUFBQkFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzcsImV4cCI6MTc4MjQ0OTc3N30.vGVFAZ12Mfy1jioKzvbYI-xHeRlC_o1xTWc821oHd0g)

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

ycs提供启动、停止流程的相关故障点。

yfs提供某个副本损坏的故障点。

###   [4.6 升级](#46-升级)  

ycs单裸盘向yfs管理的多盘升级，流程如下：

前置条件：准备好多盘硬件环境

1. 停止ycs进程（om适配，已经支持）
1. 导出ycr配置（om适配，已经支持）
1. 修改ycr导出文件，修改其中的voting file名称以及其他不兼容的配置项
1. 创建磁盘组（om适配，待实现）
1. 创建voting file （om适配，待实现）
1. 将ycr配置导入多盘（om适配，待实现）
1. 执行其他升级流程


###   [4.7 OM适配](#47-om适配)  

om需要适配升级流程和部署流程，升级流程详见4.6节，部署流程详见4.1节。ycsctl create cluster yascluster -ycsDiskString /dev/mapper -o 改为 ycsctl create cluster yascluster -o两个文件的默认名称是+system/ycr、+system/voting，具体由yfs提供样例

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 
1. ycr部署，yascs.ini使用默认配置
1. ycr部署，yascs.ini配置YCR_FILE_NAME， VOTING_FILE_NAME，不使用默认配置
1. 正常场景，ycs并发启动
1. 正常场景，ycs并发停止
1. 故障场景，yfs启动失败，预期：报错退出
1. 故障场景，ycs选主失败，预期：报错退出
1. 故障场景，yfs备升主失败，预期：报错退出
1. 故障场景，ycs读写voting file、ycr file失败
1. 故障场景，网络隔离，恢复后备加入集群
1. 故障场景，主磁盘故障，备升主
1. 故障场景，主磁盘故障，30s内恢复
1. 故障场景，备磁盘故障，驱离
1. 故障场景，备磁盘故障，30s内恢复
1. 多盘状态展示
1. ycsdump ycs/ycr dump功能正常
1. ycsdump ycs dump能够看到db写磁盘心跳正常
1. ycsdump ycs dump能够看到ycs写磁盘心跳正常


##   [6.资料设计章节](#6资料设计章节)  

/doc/产品文档/共享集群/集群服务管理/共享集群配置.md  新增配置参数的描述

/doc/产品文档/产品描述/产品规格/物理规格.md   “集群文件系统”项 增加对ycs多盘的说明

/doc/产品文档/安装和升级/安装部署/安装前准备/服务器准备.md

/doc/产品文档/工具手册/ycsctl/集群管理命令.md  增加对于voting file和ycr file的描述

/doc/产品文档/工具手册/yasboot/yasboot命令介绍/yasboot ycs.md 示例中增加对于voting file和ycr file的描述

/home/yasdb/anchorbase/doc/产品文档/安装和升级/安装部署/YashanDB命令行安装/共享集群部署.md   增加对于多盘的描述

/doc/产品文档/产品描述/Release Notes.md “共享存储配置” 项 增加关于多盘的描述

##   [7.未来规划](#7未来规划)  

1. oracle的投票算法对多盘的利用。
1. 磁盘删除、增加功能


##   [8.工作量评估](#8工作量评估)  

总计：6周

|SR|AR|编码|联调|总计|
|---|---|---|---|---|
|ycs多盘管理|ycr部署：ycr部署流程、读写接口封装|1人周|1周|2周|
||ycs：启动流程、停止流程、重启流程、多盘展示|1周|1周|2周|
|升级|升级|1周|1周|2周|


## Attachments:

[ycs并发启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2NhMWFkOWEzMzExZGM5OWZiIiwicmVmX2lkIjoiNjczOTZlY2M3MjgyMDZlZmI5MmYyY2Y0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTc3LCJleHAiOjE3ODI1MjUzNzd9.jrWPTXIva2wQJ4PRhLTQS0kwpgwwcKSprMe-0C5HAzo)

 (image/png)    


[ycs并发启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2M4OTcwYzJhZjRmNTIxYjhhIiwicmVmX2lkIjoiNjczOTZlY2M3MjgyMDZlZmI5MmYyY2Y0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTc3LCJleHAiOjE3ODI1MjUzNzd9.gS70-HUUI7J1fkFgxDSpKDdFhIN_FgE8yAfDXGihiTE)

 (image/png)    


[ycs并发启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2M4OTcwYzJhZjRmNTIxYjhjIiwicmVmX2lkIjoiNjczOTZlY2M3MjgyMDZlZmI5MmYyY2Y0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTc3LCJleHAiOjE3ODI1MjUzNzd9.L8jQE6meLhZQ56fAzqE2owBwdw0Zs_yDqlzqzlWsZoI)

 (image/png)    


## Comments:

|  [](null)  ,详细设计评审结论：,会议结论：    
  与会人：孟凡彬、trump、高风朴、马勇、瞿蓝孟、李垠、徐凡博、吕雷奇,  
  一、转测计划    
  多盘计划    
  联调版本提供时间：6月17号 ，om从这个时间开始适配    
  暂定多盘转测时间（不包括om）：6月17号,  
  升级最晚时间是 7月5日,二、只支持yfs管理模式，删除裸盘代码    
  三、给om拆分升级得AR    
  四、讨论一下yfs管理的术语概念,12c开始不支持使用裸设备或者块设备    
  要升级到12c，必须先将ocr和voting 迁移到asm或者共享文件系统，才能进行升级,12.2开始，不支持将ocr和voting file直接放到共享文件系统,19.3开始，对于standalone cluster，ocr和voting file又可以放到共享文件系统了    
  但是对于oracle domain service clusters，ocr和voting file必须放在asm管理,Posted by liyin at 六月 04, 2024 20:05|
|---|
|  [](null)  ,6月26日讨论纪要,一、非crc和副本错误，yfs返回失败，ycs自杀    
  二、yfs的读接口，返回值中携带”crc/副本错误“的节点号    
  三、保留多数派原则版本一致，返回成功，比如读到版本 2 1 1返回1，读到版本2 2 1，返回2    
  四、写接口改为：要求多数派写成功返回成功，否则返回失败    
  五、删除修复流程,Posted by liyin at 七月 23, 2024 12:41|


