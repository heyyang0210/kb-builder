Created by 高亚宁, last modified on 十月 25, 2024

# 1.   **概述**

-   [1. 概述](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-1.概述)  
-   [2. 需求分析](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-2.需求分析)  
-   [3. 测试设计方法](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-3.测试设计方法)  
-   [4. 详细测试设计](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-4.详细测试设计)  
    -   [4.1 语法](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-4.1语法)  
    -   [4.2 功能](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-4.2功能)  
-   [5. 测试用例设计](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-5.测试用例设计)  
-   [6. 测试框架设计](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-7.测试环境说明)  
-   [8. 测试工作量评估](#YDBRD33709yasrman恢复支持设置还原的路径测试设计-8.测试工作量评估)  


本文描述yasrman恢复支持设置还原路径的测试设计

# 2.   **需求分析**

SR链接：    [https://pingcode.yasdb.com/pjm/items/670732abe489dd0868f34218](https://pingcode.yasdb.com/pjm/items/670732abe489dd0868f34218)    ?    
  #YDBRD-33709 yasrman恢复支持设置还原的路径

开发文档：    [数据库异地恢复特性设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171055929)  

需求来源：  内部需求

部署形态：  单机、分布式和集群

场景：崖山当前只能恢复到备份时的路径，假如恢复目标环境的磁盘分配空间原来备份环境差异过大时，就非常需要该功能解决问题

功能说明：

1. 支持恢复到指定目录 
1. 原文件支持恢复时指定新文件全绝对路径和名字


**特性设计：**

1. 引入临时文件MAPPFILE，若要在不同的路径恢复备份集， 需要从备份集 DUMP 备份集路径信息至临时文件
1. 通过手动修改临时文件路径转换信息
1. 执行RESTORE DATABASE，实现异地恢复


|接口|简介|详细介绍|
|:---|:---|:---|
|LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；|输出备份集的路径信息至map文件中。|指定的tag必须存在于指定的catalog中，mapfile指定的为不存在的普通文件，且必须指定为绝对路径|
|RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;|执行RESTORE操作，对应的路径转换 恢复至目标位置。|指定的mappfile为上述接口执行生成的文件，恢复指定可手动修改target_path为目标转换路径，不做转换的可不做修改|


  [规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)    **：**

1. 单机指定存在的目标路径即可
1. 集群恢复需要指定为共享存储路径
1. 分布式只涉及DB级别的路径转换
1. 增量备份集恢复路径转换，指定要恢复的目标备份集转出路径文件
1. 必须是yasrman生成的备份集（存在于catalog中）


# 3.   **测试设计方法**

1. 2个新增接口的语法测试，等价类划分法
1. 异地恢复流程、  database和datafile 两种粒度、  异常测试，场景法和错误推测法
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4.   **详细测试设计**

测试观测点：

- dump后，map文件中的信息是否正确
- 异地恢复成功后，校验文件路径和数据量是否正确，yasrman的日志记录是否正确
- 覆盖单机、集群、分布式
- 覆盖yasrman全量备份集恢复、增量备份集恢复、归档恢复/pitr恢复
- 相关视图校验：v$instance，v$datafile，v$cm_node_info，dba_data_files，dba_data_buckets


### **4.1 语法**

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；,输出备份集的路径信息至map文件中,  
    
    
|正确语法，tag和  map文件名称都正确|在yasql中执行|
||文件路径长度等于255|在yasrman中执行，但catalog中不存在该tag|
||map_file路径包含//|mapfile使用相对路径|
||  
|LIST BACKUP TAG  'bak_tag' MAPPED FILE  ‘map_file’；|
||  
|tag格式不对：,tag为双引号,tag为空、空串、null,tag缺省：,LIST BACKUPSET 'bak_tag' MAPPED FILE  ‘map_file’；,LIST BACKUPSET TAG  MAPPED FILE  ‘map_file’；,写多个存在的tag,tag写错|
||  
|MAPPED FILE写错或者缺失|
||  
|‘map_file’格式或者内容不对：,map_file  为双引号,map_file  为空、空串、null,map_file  缺省：,LIST BACKUPSET tag 'bak_tag' MAPPED FILE ；,LIST BACKUPSET TAG 'bak_tag'  MAPPED ‘map_file’；,写多个存在的  map_file路径|
||  
|TAG和MAPPED FILE位置交换|
||  
|文件路径长度大于255|
||  
|指定路径下已存在同名的mapfile|
||  
|集群下路径指定为共享盘路径|
|RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;,执行RESTORE操作，对应的路径转换 恢复至目标位置。|正确语法，tag和  map文件名称都正确|map_file路径不存在|
||一次执行多个  LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；，选择其中一个  map_file做恢复|tag和  map_file不匹配|
||map_file路径包含//|MAPPED FILE关键字缺失或者写错|
||map_file路径长度255|‘map_file’缺失或者使用相对路径|
||  
|‘map_file’格式不对：,使用双引号,为空，空串，null,map_file包含空格？|
||  
|map_file路径长度256|


### **4.2 功能**

|  
|部署形态|测试场景|预期|备注|
|---|---|---|---|---|
|1|单机（工具和数据库分开部署）|yasrman异地恢复全量备份集（dest server）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database   
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
1. 校验恢复后的数据量，数据文件路径
|恢复成功，数据量与备份集中的一致，恢复后的数据文件路径与  map_file中的一致|map_file路径在本地|
|2|  
|yasrman异地恢复增量备份集（dest client），基线的路径各不相同：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致）
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
1. 校验恢复后的数据量，数据文件路径
|恢复成功，数据量与备份集中的一致，恢复后的数据文件路径与  map_file中的一致|  
|
|3|  
|yasrman异地恢复差量备份集，使用pitr恢复（dest server）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致）
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’ until scn/time;
1. 校验恢复后的数据量，数据文件路径
|恢复成功，数据量与备份集中的一致，恢复后的数据文件路径与  map_file中的一致|  
|
|4|  
|yasrman异地恢复增量备份集（dest client）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致），map_file里的  database_target_home  错误
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
|恢复报错|错误包括：为空，写错，格式错误（恢复失败），路径不存在（恢复失败），存在非法字符（关键字会报错，路径转换失败）、重复,+dbid不校验，尝试转换，如果转换失败，restore不会报错，使用原路径恢复|
|5|  
|yasrman异地恢复增量备份集（dest server）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致），map_file里的  database_origin_home错误
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
|yasrman和db在同一台机器，恢复成功,yasrman和db在不同机器，恢复报错？|  `nodeId：0`      
    `database_origin_home: 原始的数据库的home路径`      
    `database_target_home: 目标的数据库路径，如果指定，后续为指定的datafile路径均restore在这个路径下，若单独指定了datafile路径，则以单独指定的datafile 路径为主`      
    
    `tablespace_id:0, datafile_id:0`      
    `origin_path:/home/zhangxt/yasdata/dbfiles/`      `system`      
    `target_path:`  |
|6|  
|yasrman异地恢复增量备份集（dest client）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致），map_file里的  nodeId  错误
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
|恢复报错|  
|
|7|  
|yasrman异地恢复增量备份集（dest client）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致），map_file里的以下内容错误：    
  tablespace_id:0, datafile_id:0    
    `origin_path:/home/zhangxt/yasdata/dbfiles/`      `system`    target_path:
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
|恢复报错|  
|
|8|  
|yasrman异地恢复增量备份集（dest client）：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；
1. 修改map_file里面的信息，颗粒度database+datafile（datafile与database路径不一致），map_file里的内容为空
1. RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;
|yasrman和db在同一台机器，恢复成功,yasrman和db在不同机器，恢复报错？|  
|
|9|  
|手动删除  map_file文件，执行RESTORE DATABASE FROM tag 'tag_name'    MAPPED FILE  ‘map_file’;|恢复报错|  
|
|10|  
|LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；过程中，kill yasrman|map_file生成失败，不会删除生成的map_file|  
|
|11|  
|restore过程中，rm删除  map_file|恢复成功？与删除的时间有关系|  
|
|12|  
|datafile配置个数为  **32768，32769**|**32768**  恢复成功,**32769**  恢复报错|无法构造，数据文件数量最大是16384个，配置16384个测试|
|13|+|修改mapfile的文件权限为只读|恢复报错|  
|
|14|+|修改mapfile的文件目录权限，执行list backupset|dump报错|  
|
|15|+|rman和备份集不在一起，数据库状态非nomount|恢复报错|  
|
|16|+|mapfile文件类型是text，改为其他文件类型|恢复成功|  
|
|17|集群（工具和数据库分开部署）|覆盖以上场景，恢复至不同的DG0|  
|  
|
|18|  
|map_file中指定普通盘路径|恢复报错|  
|
|19|  
|备份集在普通盘|恢复成功|  
|
|20|  
|备份集在共享盘|恢复成功|  
|
|21|分布式|覆盖以上场景|  
|分布式的datafile路径仅列出显示，不做应用，仅使用database级别的路径转换|


# 5.  ** **  **测试用例设计**

文本用例

[备份恢复.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDFhMWFkOWEzMzExZGM5YjdjIiwicmVmX2lkIjoiNjczOTZmMDE3MjgyMDZlZmI5MmYyZjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODMwLCJleHAiOjE3ODI1NDUyMzB9.GldSW-MLVMLwvN-RKbX1yREglSy3O50GKrzEmHXrwgs)

# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 8.   **测试工作量评估**

15人天：

10/21：测试设计

10/22：测试设计评审

10/28：转测

11/11：上车

  


  


  


## Attachments:

[dump and trace测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDFhMWFkOWEzMzExZGM5YjdkIiwicmVmX2lkIjoiNjczOTZmMDE3MjgyMDZlZmI5MmYyZjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODMwLCJleHAiOjE3ODI1NDUyMzB9.fTEG36qmgZvpUabfezCUhYT03t5_hXunc3sVjJHWVYM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[ADR测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDFhMWFkOWEzMzExZGM5YjdlIiwicmVmX2lkIjoiNjczOTZmMDE3MjgyMDZlZmI5MmYyZjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODMwLCJleHAiOjE3ODI1NDUyMzB9.uIn-_RJseEaGI2kKUYEkug8znB5_0n3-N26PI3NfBiM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[自动故障事件框架.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDE4OTcwYzJhZjRmNTIxZDBkIiwicmVmX2lkIjoiNjczOTZmMDE3MjgyMDZlZmI5MmYyZjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODMwLCJleHAiOjE3ODI1NDUyMzB9.ARVEQUuUfNN8LFQ20hH-kURHKu6qEMx-EnGgOcPDmHs)

 (application/vnd.xmind.workbook)    


[image2024-10-21_16-54-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDFhMWFkOWEzMzExZGM5YjdmIiwicmVmX2lkIjoiNjczOTZmMDE3MjgyMDZlZmI5MmYyZjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODMwLCJleHAiOjE3ODI1NDUyMzB9.kIwsR-A6gUN7EQskeUIL8f4bt2Nf9MMznbaxpPzPKV8)

 (image/png)    


[备份恢复.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDFhMWFkOWEzMzExZGM5YjdjIiwicmVmX2lkIjoiNjczOTZmMDE3MjgyMDZlZmI5MmYyZjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODMwLCJleHAiOjE3ODI1NDUyMzB9.GldSW-MLVMLwvN-RKbX1yREglSy3O50GKrzEmHXrwgs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,参会人：高亚宁、赵楠、马志宏、张旭涛、刘大境,会议时间：2024/10/22,会议地点：西安会议室2,测试设计评审会议纪要：,1. LIST BACKUPSET TAG  'bak_tag' MAPPED FILE  ‘map_file’；语法增加集群下路径指定为共享盘路径，执行报错
1. 观测点增加视图校验：  v$instance，v$datafile，v$cm_node_info，dba_data_files
1. 功能场景补充：    
  a. 修改mapfile的文件权限为只读，恢复报错    
  b. 修改mapfile的文件目录权限，执行list backupset，dump报错    
  c. rman和备份集不在一起，数据库状态非nomount，恢复报错    
  d. mapfile文件类型是text，改为其他文件类型，恢复成功
1. mapfile的异常补充非法字符场景
,Posted by gaoyaning at 十月 22, 2024 16:34|
|---|
