Created by 易文亮, last modified on 十一月 08, 2024

# 1. 概述

*本需求的背景，*  *YDBRD-26948 【嘉实 poc】主备部署模式，slice 文件较多时，重启主节点后，无法立即执行 ddl 及事务操作；*  *LSC slice 文件加载性能优化测试设计*  *。*

# 2. 需求分析

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/66bdc72e8f5ee191734e238f?](https://pingcode.yasdb.com/pjm/items/66bdc72e8f5ee191734e238f?)  

#YDBRD-31640 LSC slice文件加载性能优化

*开发设计：*  [https://pingcode.yasdb.com/wiki/pages/6739daf4728206efb93155f0](https://pingcode.yasdb.com/wiki/pages/6739daf4728206efb93155f0)  

## 2.1 功能点分析

- 新建索引结构的方式，能达到
-     1. 去除不必要的读取slice元数据文件的io，用极少量的索引文件io代替；
    1. 在主备重连及主备备份等需要过滤lfn的场景中能快速定位slice且减少扫描范围。



## 2.2 应用场景

- *主备同步slice发送*
- *全量及增量backup和restore、build、并行build、表空间迁移验证*
- *带slice旧版本升级场景*


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*本需求的功能验证主要使用场景和异常推测测试法，文件写满的逻辑结合等价类进行验证。*

## 3.2 详细测试设计

1. *验证功能*


|序号|测试内容|期望|备注|
|---|---|---|---|
|1|*普通表/分区表插数转换、insert bulkload构造slice，确认index slice的写入逻辑*|新slice追加写入，数据正确，一个index slice写满，会生成新的index slice|  
|
|2|多个slice合并，  *确认index slice的写入逻辑*|废弃slice不清理，新slice追加写入|  
|
|3|持续构造slice写满一个index slice，继续构造slice|会生成第二个index slice|一个block 8KB，除去头部128B能存储126条，一个文件有1K个block，保留第一个block为文件头，剩余1023个block写slice，一共128898条信息|
|4|构造多个slice，全部delete后再compact，确认index slice|index slice不会被清理|有主备才有index slice |
|5|truncate/drop表，确认index slice|index slice不会被清理，走归档清理机制|  
|
|6|全量backup和restore|备份不会保存index slice，restore会生成，查询正常|  
|
|7|构造slice后进行backup，再构造slice再增量backup和restore|不会备份index slice文件，restore时生成，查询正常|  
|
|8|构造slice后进行全量build|build成功，备机会生成index slice|  
|
|9|构造slice后进行增量build|build成功，确认index slice|  
|
|10|建表构造slice旧版本升级到新版本|会生成index slice，业务功能正常|  
|
|11|建表构造slice验证表空间迁移|迁移前后功能正常|  
|
|12|故障测试：备份过程中杀库再重新备份|能正常备份|  
|
|13|增加节点，build构建新的备机|确认下index slice，功能正常|  
|
|14|index slice内容篡改、误删后，验证起库及业务|起库加载会出发重建、写操作触发重建，不会影响增删查改业务|  
|
|15|  
|  
|  
|
|16|  
|  
|  
|
|17|slice同步性能验证|~~性能提升~~| 最大保护模式      （构造1Wslice后，主库启动到能执行事务的RTO、failover的RTO时间、主备自动选主RTO及slice同步时长 ）|
|18|RTO性能验证|性能提升|最大保护模式|
|  
|*build性能验证*|性能不下降|  [https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_br23.2/job/br23.2_L3_sa_Perf_build/](https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_br23.2/job/br23.2_L3_sa_Perf_build/)  23,修改配置sed -i "s#daily#agile#g" ${WORKSPACE}/ciscript/util/common.sh   br23.2改为开发包分支|
|  
|*backup性能验证*|性能不下降|  [https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_master/job/master_L3_sa_perf_Backup_Restore](https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_master/job/master_L3_sa_perf_Backup_Restore)  /159,修改配置sed -i "s#daily#agile#g" ${WORKSPACE}/ciscript/util/common.sh   master改为开发包分支|


       2.涉及

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|Y|  
|
|KT|Y|  
|
|长稳|N|  
|
|一致性|N|  
|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|安全|N|  
|
|DFR|N|  
|
|HA|Y|  
|
|压力|N|  
|
|性能|Y|  
|
|可维护性|N|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- Guider/ha_regress


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *10人天*

计划测试完成时间：

## Comments:

|  [](null)  ,测试设计评审：,参与人：黄子迅、黄文早、谢锐、马志宏、易文亮,1、有主备才会生成index slice，没备机不影响 ——逻辑确认,2、index slice篡改或者删除后能自动识别重新生成——功能点补充,3、RTO在最大保护模式下进行验证——功能点细化,Posted by yiwenliang at 十一月 08, 2024 18:41|
|---|


附录（性能测试数据）：

||表数*单表slice数|master版本||当前版本||
|---|---|---|---|---|---|
|||sync|rto|sync|rto|
|最大性能模式|10*10|4.93|3.59|4.61|3.41|
||10*100|14.83|4.1|5.12|3.03|
||10*1000|94.25|4.44|4.45|3.98|
||100*1|5.62|3.67|4.59|3.16|
||100*10|15.13|3.83|4.56|3.3|
||100*100|93.71|3.6|4.55|3.67|
|最大保护模式|10*10|0.15|7.87|0.28|7.8|
||10*100|0.18|11.05|0.15|7.62|
||10*1000|0.17|30.81|0.04|8.15|
||100*1|0.03|7.71|0.03|7.92|
||100*10|0.02|11.15|0.02|7.91|
||100*100|0.07|29.9|0.15|7.75|


结论：本SR实现后，最大保护模式下，100个slice和1W个slice加载性能相近，slice加载耗时不再随slice数的增加而增长。