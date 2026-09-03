Created by 吕雷奇, last modified by  张彩虹 on 二月 26, 2024

sr连接：    [YDBRD-21456](https://jira.yasdb.com/browse/YDBRD-21456?src=confmacro)    -  YFS 支持fast recovery area  完成

开发设计文档：    [YDBRD-21456：yfs支持fast recovery area特性详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135605337)  

# 1. 概述

DG单副本下，实现了对yfs元数据的冗余，在FRA内冗余的元数据可以恢复。

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


1、FRA区域默认开启，可以通过YFS_FRA_ENABLE  来设置是否开启（TRUE|FALSE）。  设置方式？是否可以通过alter system set 语法设置？如果可以是否立即生效？ – 只支持设置yasfs.ini 文件

2、FRA大小设置可以参数YFS_FRA_SIZE，默认64M，最小37M。最大161M。  设置方式？是否可以通过alter system set 语法设置？如果可以是否立即生效？ – 只支持设置yasfs.ini 文件

3、创建external diskgroup时，默认创建快速恢复区；

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


针对冗余级别为external的diskgroup支持FRA功能。为该diskgroup的元数据提供冗余备份。元数据被破坏时，可以从FRA获取备份数据，并做自动恢复。  快速恢复区大小固定，因此需要循环使用。

相关联场景，多DG场景，性能场景

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


快速恢复区的大小是固定的。一旦创建，不可以修改。快速恢复区是循环使用的。

FRA支持的元数据如下：

- [x] diskHeader   

- [x] PST   

- [x] bitmap   

- [x] 文件fileCtrl   

- [x] 文件directFileCtrl   

- [x] 目录文件   

- [x] redo文件   

# 3. 详细测试设计

## 3.1 测试设计方法

参数测试使用边界值法，业务场景构造遍历支持的元数据类型，通过设置断点测试FRA流程

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


FRA流程测试

|序号|场景|断点名称|报错内容|  
|
|---|---|---|---|---|
|1|设置断点1，创建FRA文件失败，报错；|YFS_FAULT_POINT_28|create FRA failed|  
|
|~~2~~|~~设置断点2，~~  ~~dg内所有磁盘的diskHeader和PST写入FRA文件失败，报错；~~|~~YFS_FAULT_POINT_29~~|~~bak pst and diskhead failed~~|  
|
|3|设置  断点3，redo内容写入FRA失败，报错|YFS_FAULT_POINT_30|bak redo content to FRA failed|  
|
|4|设置  断连4，  FRA 校验失败，清空FRA内容，报错；|YFS_FAULT_POINT_31|verify FRA block failed|  
|
|5|设置  断点5，  diskHeader、pst、bitmap数据校验失败，打印error日志报错，FRA查找冗余数据，并修复，执行成功；|YFS_FAULT_POINT_32，YFS_FAULT_POINT_33，YFS_FAULT_POINT_34|verify disk head failed，verify pst failed，verify bitmap failed|  
|
|6|设置  断点6、加载目录树时，元数据校验失败，打印error日志报错，在FRA中找备份数据，并修复，执行成功；|YFS_FAULT_POINT_35|verify dir failed|  
|
|7|设置  断点7、in  directFileCtrl(AU大小1M，创建超过60M文件的时候)|*YFS_FAULT_POINT_37*|*verify indirect AU failed*|  
|
|8|设置  断点8、superFileCtrl 1号文件 第1个block，用户自己FileCtrl 1号文件 第256号block之后都是|*YFS_FAULT_POINT_38*|*verify normal fileCtrl failed*|  
|
|9|设置  断点9、   * freelist *  1号文件第0个block|*YFS_FAULT_POINT_39*|*verify freelist failed*|  
|
|10|设置  断点7、FRA空间占满，立即触发回收，打印日志；32*4K + 2个bitmap（2*1AU）|  
|  
|  
|


*FAULT_POINT_INFO_DEF(FP_YFS_37, FP_MOD_YFS, "YFS_FAULT_POINT_37", "loadIndirectBlock", "verify indirect AU failed"),*    
  *FAULT_POINT_INFO_DEF(FP_YFS_38, FP_MOD_YFS, "YFS_FAULT_POINT_38", "loadRegularFile", "verify normal fileCtrl failed"),*    
  *FAULT_POINT_INFO_DEF(FP_YFS_39, FP_MOD_YFS, "YFS_FAULT_POINT_39", "loadReservedFile", "verify freelist failed"),*

参数测试

|序号|场景|预期|  
|
|---|---|---|---|
|1|不设置参数  YFS_FRA_ENABLE  ，安装部署集群|集群功能正常，可以通过show para查看设置结果，yfsminer 查看4号文件，AU count|  
|
|2|设置YFS_FRA_ENABLE为TRUE，安装部署集群|集群功能正常，可以通过show para查看设置结果|  
|
|3|设置YFS_FRA_ENABLE为FALSE，安装部署集群|集群功能正常，可以通过show para查看设置结果|  
|
|4|设置YFS_FRA_ENABLE为其他特殊字符、中文字符、数字等，重启集群|实例启动报错，报错内容正常|  
|
|5|不设置YFS_FRA_SIZE，安装部署集群|集群功能正常，可以通过show para查看设置结果  YFS_FRA_SIZE为512M|  
|
|6|设置YFS_FRA_SIZE为256M，安装部署集群|集群功能正常，可以通过show para查看设置结果  YFS_FRA_SIZE为256M|  
|
|7|设置YFS_FRA_SIZE为20000M，安装部署集群|集群功能正常，可以通过show para查看设置结果  YFS_FRA_SIZE为20000M|  
|
|8|设置YFS_FRA_SIZE为255M，安装部署集群|实例启动报错，报错内容正常|  
|
|9|设置YFS_FRA_SIZE为162M，安装部署集群|实例启动报错，报错内容正常|  
|
|10|设置YFS_FRA_SIZE为其他特殊字符、中文字符、数字等，重启集群|实例启动报错，报错内容正常|  
|


业务场景

|序号|场景|预期|进展|备注|
|---|---|---|---|---|
|1|单DG多副本下（normal|high）下设置  YFS_FRA_ENABLE为 TRUE|集群功能正常，可以通过show para查看设置结果，数据恢复通过多副本来保证恢复|完成|  
|
|2|单DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE|破坏diskhead ,重启集群实例，可以正常启动，使用yasminer查看破坏地方已经被修复|完成|diskHeader 磁盘0号AU的0号block    
  echo AAAAAAAAAAAAAAAAAA | dd bs=18 count=1 conv=notrunc of=/dev/mapper/lun032T|
|3|单DG单副本下，下设置  YFS_FRA_ENABLE为 FALSE|破坏diskhead ,重启ycs实例，重启失败|完成|diskHeader 磁盘0号AU的0号block    
  echo AAAAAAAAAAAAAAAAAA | dd bs=18 count=1 conv=notrunc of=/dev/mapper/lun032T|
|4|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE|破坏PST,重启集群实例，可以正常启动，使用yasminer查看破坏地方已经被修复|完成|pst位置在disk的第二个au的第一个block，block大小为4k。au大小根据实际情况计算。 seek=8192为32M/4k    
  dd if=/dev/urandom count=1 bs=4096 seek=8192 of=/dev/mapper/lun032T|
|5|多DG单副本下，下设置  YFS_FRA_ENABLE为FALSE|破坏PST,重启集群实例，重启失败|完成|  
|
|6|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE|破坏bitmap,重启集群实例，可以正常启动，使用yasminer查看破坏地方已经被修复|有core(已知)|bitmap位置，一个diskgroup内，不要用第一块盘（第一块盘存放fra），用第二块或者第三块。位置是第三个au    
  dd if=/dev/urandom count=1 bs=32M seek=2 of=/dev/mapper/lun032T,  
,bitmap不能用在第一块盘|
|7|多DG单副本下，下设置  YFS_FRA_ENABLE为 FALSE|破坏bitmap,重启集群实例，重启失败|完成|  
|
|8|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE|破坏文件fileCtrl ,重启集群实例，创建文件,可以正常启动，使用yasminer查看破坏地方已经被修复|  
|与开发沟通无法构造此场景|
|9|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE|破坏文件directFileCtrl,重启集群实例，创建超过60AU文件,可以正常启动，使用yasminer查看破坏地方已经被修复|  
|与开发沟通无法构造此场景|
|10|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE，DG下创建目录|破坏目录文件,重启集群实例，可以正常启动，使用yasminer查看破坏地方已经被修复|手动测试完成|  
|
|11|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE，做业务后|破坏redo文件,重启集群实例，可以正常启动，使用yasminer查看破坏地方已经被修复|手动测试完成|  
|
|12|多DG单副本下，下设置  YFS_FRA_ENABLE为 TRUE，YFS_FRA_SIZE为256M，做长时间业务后|构造  FRA被复用，破坏目录文件，重启集群实例，重启报错|构造场景不一定能触发|  
|
|13|使用默认值，跑TPCC性能场景，看是否对当前性能有影响|  
|完成|  
|
|14|实例之间两个参数不一致，可能导致数据写坏|  
|  
|  
|


  


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|不涉及|  
|
|KT|不涉及|  
|
|长稳|涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR|不涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|涉及|  
|
|可维护性|涉及|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；


  


1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



## Comments:

|  [](null)  ,FAULT_POINT_INFO_DEF(FP_YFS_28, FP_MOD_YFS, "YFS_FAULT_POINT_28", "yfsFraFormat", "create FRA failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_29, FP_MOD_YFS, "YFS_FAULT_POINT_29", "bakDiskHeadAndPst", "bak pst and diskhead failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_30, FP_MOD_YFS, "YFS_FAULT_POINT_30", "yfsRdCommit", "bak redo content to FRA failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_31, FP_MOD_YFS, "YFS_FAULT_POINT_31", "doFraLoad", "verify FRA block failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_32, FP_MOD_YFS, "YFS_FAULT_POINT_32", "yfsReadDiskHead", "verify disk head failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_33, FP_MOD_YFS, "YFS_FAULT_POINT_33", "yfsLoadDiskPst", "verify pst failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_34, FP_MOD_YFS, "YFS_FAULT_POINT_34", "yfsLoadDiskMaps", "verify bitmap failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_35, FP_MOD_YFS, "YFS_FAULT_POINT_35", "yfsGetDirBlock", "verify dir failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_36, FP_MOD_YFS, "YFS_FAULT_POINT_36", "loadSuperFileMetaFromDisk", "verify superfile fileCtrl failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_37, FP_MOD_YFS, "YFS_FAULT_POINT_37", "loadIndirectBlock", "verify indirect AU failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_38, FP_MOD_YFS, "YFS_FAULT_POINT_38", "loadRegularFile", "verify normal fileCtrl failed"),    
  FAULT_POINT_INFO_DEF(FP_YFS_39, FP_MOD_YFS, "YFS_FAULT_POINT_39", "loadReservedFile", "verify freelist failed"),,Posted by lvleiqi at 一月 23, 2024 11:42|
|---|
