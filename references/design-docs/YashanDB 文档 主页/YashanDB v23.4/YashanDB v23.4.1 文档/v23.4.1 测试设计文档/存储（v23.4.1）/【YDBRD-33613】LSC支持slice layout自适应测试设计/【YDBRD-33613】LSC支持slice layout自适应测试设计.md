Created by 易文亮, last modified on 十一月 08, 2024

# 1. 概述

*本需求的背景，*  *slice_layout默认是sile，元数据和数据分开存储，数据量较少，列较多时slice文件多，导致bucket的backup/build性能差；*  *本文档描述slice layout自适应测试设计。*

# 2. 需求分析

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/67064719e489dd0868f2ebef](https://pingcode.yasdb.com/pjm/items/67064719e489dd0868f2ebef)    *?*

*开发设计：*    [YDBRD-33613：LSC文件支持SLICE LAYOUT，自适应 - 梁桢灏 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=171062004)  

## 2.1 功能点分析

- *参数_SCOL_SLICE_LAYOUT增加值auto，默认值有silo改为auto；*
- *验证layout自适应的类型是否符合预期：非bulkload插入，默认slice；bulkload插入默认silo，分别验证insert/datax/flink/yasldr的bulkload和非bulkload写入；*
- *slice格式存储和silo存储文件确认；*
- *yasminer解析slice meta\silo meta及混合*


## 2.2 应用场景

- *insert/datax/flink/yasldr的bulkload和非bulkload写入、转换和合并的layout自适应机制*
- *_SCOL_SLICE_LAYOUT为*  *slice格式删列*
- *带多个slice的主备复制、build、并行build/backup、表空间迁移验证*


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*参数验证主要使用等价类*

*功能验证主要使用场景和异常推测测试法*

## 3.2 详细测试设计

1. *验证功能*


|序号|测试内容|期望|备注|
|---|---|---|---|
|1|*普通表/分区表_SCOL_SLICE_LAYOUT设置为slice构造冷数据，增删查改*|功能正常，删列不会产生garbage_data$|  
|
|2|指定  *_SCOL_SLICE_LAYOUT=silo/slice/column构造冷数据，确认实际数据结构*|数据结构跟指定的layout完全对应|  
|
|3|指定  *_SCOL_SLICE_LAYOUT=auto  datax/flink/yasldr+非bulkload导入小量数据*|layout自适应使用slice|  
|
|4|指定  *_SCOL_SLICE_LAYOUT=auto  datax/flink/yasldr+非bulkload导入大量数据*|layout自适应使用silo|  
|
|5|指定  *_SCOL_SLICE_LAYOUT=auto  datax/flink/yasldr+bulkload导入小量数据*|layout自适应使用slice|  
|
|6|指定  *_SCOL_SLICE_LAYOUT=auto  datax/flink/yasldr+bulkload导入大量数据*|超过buffer，layout自适应使用silo|buffer写满，不受128K限制，同insert bulkload|
|7|修改rgd_count值，bulkload写入，增删查改|功能正常|  
|
|8|insert的数据小于等于128K进行转换|layout自适应使用slice|  
|
|9|insert大于128K+delete后数据小于128K进行转换|layout自适应使用slice|  
|
|10|insert的数据大于128K进行转换|layout自适应使用silo|  
|
|11|合并的数据小于等于128K|layout自适应使用slice|  
|
|12|slice大于128K，删掉冷数据后小于128K进行合并|layout自适应使用slice|  
|
|13|合并的数据大于等于128K|layout自适应使用silo|  
|
|14|指定  *_SCOL_SLICE_LAYOUT设置为slice进行yasminer解析*|解析的元数据正确|  
|
|15|指定  *_SCOL_SLICE_LAYOUT设置为slice构造大量slice验证主备复制/failover/switchover*|功能正常|  
|
|16|指定  *_SCOL_SLICE_LAYOUT设置为slice构造大量slice验证build*|功能正常，性能有提升|  
|
|17|指定  *_SCOL_SLICE_LAYOUT设置为slice构造大量slice验证backup*|功能正常，性能有提升|  
|
|18|指定  *_SCOL_SLICE_LAYOUT设置为slice大量slice验证表空间迁移*|功能正常|  
|
|  
|*_SCOL_SLICE_LAYOUT自适应build性能验证*|性能有提升|  [https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_br23.2/job/br23.2_L3_sa_Perf_build/](https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_br23.2/job/br23.2_L3_sa_Perf_build/)  ,修改配置sed -i "s#daily#agile#g" ${WORKSPACE}/ciscript/util/common.sh   br23.2改为开发包分支|
|  
|*_SCOL_SLICE_LAYOUT自适应backup性能验证*|性能有提升|  [https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_master/job/master_L3_sa_perf_Backup_Restore](https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_perf_master/job/master_L3_sa_perf_Backup_Restore)  ,修改配置sed -i "s#daily#agile#g" ${WORKSPACE}/ciscript/util/common.sh   master改为开发包分支   155|
|  
|*_SCOL_SLICE_LAYOUT自适应bulkload/非bulkload导入性能*|性能不下降|  [https://jenkins.yasdb.com/job/zfy_master_sa_ssd_copy/configure](https://jenkins.yasdb.com/job/zfy_master_sa_ssd_copy/configure)  |
|  
|*_SCOL_SLICE_LAYOUT自适应tpch查询性能*|性能不下降|  
|


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

附录：

1）tpcc数据build性能测试结果：

|压缩加密|并行度|耗时s|速率M/s|耗时s|速率M/s|
|---|---|---|---|---|---|
|nocompress|back parallel=2|98|254.46|39|639.41|
|nocompress|back parallel=8|19|1312.43|17|1466.85|
|zstd-low|back parallel=2|44|566.73|44|566.73|
|zstd-low|back parallel=8|14|1781.16|13|1818|
|zstd-medium|back parallel=2|77|323.85|78|319.7|
|zstd-medium|back parallel=8|22|1133.46|21|1187.44|
|zstd-high|back parallel=2|165|151.13|168|148.23|
|zstd-high|back parallel=8|50|498.72|50|498.72|
|lz4-low|back parallel=2|44|566.73|44|566.73|
|lz4-low|back parallel=8|13|1918.17|14|1781.16|
|lz4-medium|back parallel=2|140|178.12|139|179.40 |
|lz4-medium|back parallel=8|36|692.67|37|673.95|
|lz4-high|back parallel=2|163|152.98|162|153.93|
|lz4-high|back parallel=8|42|593.72|42|593.72|
|aes128|back parallel=2|42|593.72|43|579.91|
|aes128|back parallel=8|19|1312.43|19|1312.43|
|aes192|back parallel=2|42|593.72|43|579.91|
|aes192|back parallel=8|19|1312.43|19|1312.43|
|aes256|back parallel=2|43|579.91|43|579.91|
|aes256|back parallel=8|19|1312.43|19|1312.43|
|sm4|back parallel=2|166|150.22|169|147.55|
|sm4|back parallel=8|47|530.56|46|542.09|


无压缩加密无并行时提升比较大。考虑到tpcc的slice默认是silo，性能影响不大，以下使用自建的小slice模型进行测试。

构造1000个小slice进行backup：

|新版本耗时LAYOUT=auto||旧版本耗时LAYOUT=silo||
|---|---|---|---|
|backup|restore|backup|restore|
|11s|12s|39s|40s|


23.2backup和build带了并行，100G tpch的数据：

|新版本耗时LAYOUT=slice||旧版本耗时LAYOUT=silo||
|---|---|---|---|
|2并行|8并行|2并行|8并行|
|1957s|1432s|6605s|5989s|


## Comments:

|  [](null)  ,测试评审会议纪要：,参与人：梁桢灏、黄文早、谢锐、易文亮,1、明确bulkload写入，rgd buffer写满则以silo存储，不满则slice；非bulkload写入转换128K以下为slice写入，超过则为silo,2、补充测试点：,1）插入热数据，删除部分热数据后再转换，验证layout自适应情况,2）删除部分冷数据后，再合并，验证layout自适应情况,Posted by yiwenliang at 十月 23, 2024 14:49|
|---|
