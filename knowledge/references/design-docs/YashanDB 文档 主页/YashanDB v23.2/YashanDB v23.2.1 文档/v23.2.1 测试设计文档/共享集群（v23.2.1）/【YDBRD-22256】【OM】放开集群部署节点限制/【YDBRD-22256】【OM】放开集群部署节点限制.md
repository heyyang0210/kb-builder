Created by 张丽红 on 一月 31, 2024

  


**IR链接：**    [YDBRD-20478](https://jira.yasdb.com/browse/YDBRD-20478?src=confmacro)    **-**  **支持多节点集群安装部署**  **完成**

**SR链接：**    [YDBRD-22256](https://jira.yasdb.com/browse/YDBRD-22256?src=confmacro)    **-**  **【OM】放开集群部署节点限制**  **完成**

**开发设计文档链接：**    [OM支持部署8节点共享集群方案设计](135595326.html)  

**其它参考文档：**

  [om部署YCS集群设计文档](/pages/createpage.action?spaceKey=~qulanmeng&title=om%E9%83%A8%E7%BD%B2YCS%E9%9B%86%E7%BE%A4%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3)  

  [OM支持集群部署、卸载及启停测试设计](109584144.html)  

  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/YashanDB%E5%91%BD%E4%BB%A4%E8%A1%8C%E5%AE%89%E8%A3%85/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/YashanDB%E5%91%BD%E4%BB%A4%E8%A1%8C%E5%AE%89%E8%A3%85/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2.html)  

  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20package.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20package.html)  

  [https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/install_test/src/test/yasboot_rac/test_yasboot_rac.py](https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/install_test/src/test/yasboot_rac/test_yasboot_rac.py)  

  [https://jenkins.yasdb.com/view/master/view/master_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L2_cluster_FT_install_arm/](https://jenkins.yasdb.com/view/master/view/master_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L2_cluster_FT_install_arm/)  

# 1. 概述

【OM】放开集群部署节点限制：

该需求在23.1版本的基础上做了如下修改，只做了规格层面的修改，实际使用层面无任何变更：

1、om层面集群安装部署时指定的节点个数从最大值为4变为最大值为64

2、该规格变更依赖db内核和ycs内核本身支持节点数4到64的变更，已确认db和ycs内核本身已支持，不影响该需求转测

3、涉及资料变更：规格说明中集群最大节点数由4节点变为64节点（资料中并无该规格说明）

# 2. 需求分析

## 2.1 功能点分析

主要应用场景即om层面下发的集群形态下的安装部署

主要功能点分析如下：

- 正常安装部署
- 不同方式下的安装（命令行/可视化）
- 安装过程中各个子阶段的异常语法/格式/取值/场景验证
- 不满足安装条件下的安装部署，正常提示（告警/报错）
- 安装失败/成功后的重装
- 实际业务使用场景中可能出现的异常场景和安装部署的关联，安装部署工具层面能否正常检测到以及正常处理


## 2.2 规格约束

部署形态：集群

支持的节点个数：

- 节点数量最大限制为64（只是理论预留的节点规格，可以在SIT的规格测试阶段考虑是否做功能层面的验证，但是语法/配置层面需要做拦截校验）
- 该SR只用验证8节点的安装部署，以8节点为目标


可视化安装中支持的浏览器版本：

- chrome 版本 98.0.4758.102（正式版本） （64 位）
- firefox 版本99.0.1 （64位）
- edge 版本 100.0.1185.44 (正式版本) (64 位)


# 3. 详细测试设计

## 3.1 整体测试思路

1、该需求新增功能只在于一个规格变更，所以主要是把已有用例进行整改，由4节点改为8节点，这部分不做场景和用例新增，只做修改/适配

2、在复用已有用例的基础上，新增部分异常场景的测试，这部分是针对每一个细节性流程做的测试点新增，主要是用了场景法，在部分异常场景的校验中，还使用了错误推测法（针对客户真实使用场景中可能发生的错误/意外）

## 3.2 关联特性/依赖分析

|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及，当前框架尚未使用yasboot进行安装部署|
|KT|不涉及，当前框架尚未使用yasboot进行安装部署|
|长稳|不涉及，当前框架尚未使用yasboot进行安装部署|
|一致性|不涉及，当前框架尚未使用yasboot进行安装部署|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|涉及，在详细测试设计中描述|
|HA|不涉及，当前框架尚未使用yasboot进行安装部署|
|压力|不涉及，当前框架尚未使用yasboot进行安装部署|
|性能|不涉及，当前框架尚未使用yasboot进行安装部署|
|可维护性|这里需要考虑当前这部分用例的自动化实现方式|
|RTO|/|


## 3.3 详细测试设计

[YDBRD-22256 【OM】放开集群部署节点限制_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDhhMWFkOWEzMzExZGM4NWNjIiwicmVmX2lkIjoiNjczOTZiZDg1OTNmOTljOWZmMjM2NzhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzY3LCJleHAiOjE3ODIzODM3Njd9.6Z-2NIn8NNKCNGCvioVT-H7brV0aY46w_wfB0lONdUw)

# 4. 测试用例

该需求相对简单，不需要提供门槛用例，已和开发达成一致

[YDBRD-21543 消息管理内存自治_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDhhMWFkOWEzMzExZGM4NWNlIiwicmVmX2lkIjoiNjczOTZiZDg1OTNmOTljOWZmMjM2NzhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzY3LCJleHAiOjE3ODIzODM3Njd9.fnBhiB7I6MvdjFvkJ7GjBXArhl34bsOOTLCoEFKVSdo)

# 5. 测试框架设计

使用yastest_dfx框架做用例新增，不涉及框架工具开发和工程新增以及调度新增，无风险

用例和框架目录：    [https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/install_test/src/test/yasboot_rac/test_yasboot_rac.py](https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/install_test/src/test/yasboot_rac/test_yasboot_rac.py)  

工程链接：    [https://jenkins.yasdb.com/view/master/view/master_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L2_cluster_FT_install_arm/](https://jenkins.yasdb.com/view/master/view/master_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L2_cluster_FT_install_arm/)  

# 6. 测试环境说明

1、单实例单主机环境+单实例多主机环境（通用linux，centos，磁阵共享lun）

2、可视化测试中，涉及浏览器chrome，forefix，edge

chrome：

- 版本 119.0.6045.106（正式版本） （64 位）
- 版本 98.0.4758.102（正式版本） （64 位）


forefix：

- 88.0.1（64位）
- 99.0.1 （64位）


edge：

- 版本 119.0.2151.72 (正式版本) (64 位)
- 版本 100.0.1185.44 (正式版本) (64 位)


上述各个测试因子做正交组合后输出测试用例，从测试用例的维度进行测试

# 7. 工作量评估

工作量：9人/天

转测时间：2023/11/xx

计划测试完成时间：2023/11/xx+5

工作量分析：

|工作项|时间成本|备注|
|:---|:---|:---|
|需求调研|0.5人/天|转测前完成|
|测试设计输出及细节沟通对齐|0.5人/天|转测前完成|
|测试设计评审|0.5人/天|转测前完成|
|测试用例输出|0.5人/天|转测前完成|
|测试用例自动化|2人/天|转测前完成|
|测试执行|3人/天|  
|
|问题单跟踪回归|1人/天|  
|
|需求上车|1人/天|  
|


# 8. 上车分析

  [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/)  

|编号|工程链接|失败原因/解决方案|结果|
|---|---|---|---|
|1|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/3226/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/3226/)  |last fail 3234|pass|
|2|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/3314/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/3314/)  |last fail 3218|pass|
|3|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_KT_debug_docker/3108/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_KT_debug_docker/3108/)  |last fail 3112|pass|
|4|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/2783/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/2783/)  |last fail 2787|pass|
|5|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/3228/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/3228/)  |last fail 3232,test_sdv_supply_log_error_05:master上expect为最新结果，上车分支上expect未刷新，忽略,test_sdv_insert_into_scol_01：同上,logic_redo_part_019：同上,logic_redo_part_020：同上|pass|
|6|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_debug_docker/3321/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_debug_docker/3321/)  |last fail 3325|pass|
|7|  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_3_docker/3178/](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_3_docker/3178/)  |last fail 3182,test_sdv_supply_log_error：解析结果为空,last fail 3188|pass|
|8|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/2768/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/2768/)  |last fail 2772,test_sdv_sandbox_standby_scene_01：master上expect为最新结果，上车分支上expect未刷新，忽略|pass|
|9|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/1338/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/1338/)  |last fail 1342|pass|
|10|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1445/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1445/)  |last fail 1464,  [YDBRD-24106](https://jira.yasdb.com/browse/YDBRD-24106?src=confmacro)    -  【CI】master_L2_sa_heap_yasft_arm工程core在execFilterIn2  解决关闭  问题导致工程失败，重新rebase主干最新版本再次跑上车,last fail 1493,test_sdv_dml_fetch_02：不稳定用例，master上有相同问题，忽略,test_sdv_ydbrd_15210_pub_stat：视图V$PUB_STAT新增一个字段"START_SCN"， YDBRD-20106特性中V$TRANSACTION中新增START_SCN字段导致，忽略,test_sit_yaswrap_dwq_004：结果串行，非本次代码修改导致，忽略,test_sit_b16687_002：同上,test_sit_b16687_003：同上,test_sit_b16687_004：同上,  
|pass|
|11|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/1989/](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/1989/)  |last fail 1994,DatabaseMetaDataByUserTest. testDBMetaDataReturnSingleLine    
  DatabaseMetaDataNormalTest. testDatabaseMetaData,其它构建有相同失败，忽略|pass|
|12|  [https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasboot_load/1875/](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasboot_load/1875/)  |last fail 1878|pass|
|13|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/476/](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/476/)  |last fail 479,test_sdv_ydbrd_15210_dst_SESSTAT_002:master上expect为最新结果，上车分支上expect未刷新，忽略,test_Nestloop_full_join_004：机器内存不足导致，忽略|pass|
|14|  [https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/297/](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/297/)  |last fail 300|pass|
|15|  [https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/)  |last fail 300|pass|
|16|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/686/](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/686/)  |last fail 691,DatabaseMetaDataByUserTest. testDBMetaDataReturnSingleLine    
  DatabaseMetaDataNormalTest. testDatabaseMetaData,其它构建有相同失败，忽略|pass|
|17|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1121/](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1121/)  |last fail 1129,  [YDBRD-24106](https://jira.yasdb.com/browse/YDBRD-24106?src=confmacro)    -  【CI】master_L2_sa_heap_yasft_arm工程core在execFilterIn2  解决关闭  问题导致工程失败，重新rebase主干最新版本再次跑上车,last fail 1134|pass|
|18|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1136/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1136/)  |last fail 1139,test_sdv_ydbrd_15210_clus_FUNCTION_file:master上expect为最新结果，上车分支上expect未刷新，忽略|pass|
|19|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_2/795/](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_2/795/)  |last fail 798|pass|
|20|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/1072/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/1072/)  |last fail 1075|pass|


# 9. 后续参考

1、SIT阶段可以考虑用例yasboot进行集群安装，指定节点数为64节点的规格测试

2、提权去掉后，yasboot安装部署前提中对提权的要求要去掉，资料中需要做同步更新

3、8节点的cluster/group/node/process层面的启停操作（包括并发），需要在内核层面支持8节点的启停操作之后，做补充验证，当前内核层面只支持到了2节点

4、安装完成后，删除host.toml文件，当前没影响，但是后续如果集群支持节点动态扩展，那是会有影响的，到时候可以考虑该测试点

5、yasboot层面的停止操作当前集群并不支持，yasboot要在重构完成后考虑这一点，同时做资料更新

6、4节点故障支持后，建议新增场景：安装部署过程中磁阵lun的权限被修改

  


  


  


## Attachments:

[YDBRD-21543 消息管理内存自治_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDhhMWFkOWEzMzExZGM4NWNlIiwicmVmX2lkIjoiNjczOTZiZDg1OTNmOTljOWZmMjM2NzhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzY3LCJleHAiOjE3ODIzODM3Njd9.fnBhiB7I6MvdjFvkJ7GjBXArhl34bsOOTLCoEFKVSdo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-22256 【OM】放开集群部署节点限制_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDhhMWFkOWEzMzExZGM4NWNjIiwicmVmX2lkIjoiNjczOTZiZDg1OTNmOTljOWZmMjM2NzhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzY3LCJleHAiOjE3ODIzODM3Njd9.6Z-2NIn8NNKCNGCvioVT-H7brV0aY46w_wfB0lONdUw)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDg4OTcwYzJhZjRmNTIwNzU5IiwicmVmX2lkIjoiNjczOTZiZDg1OTNmOTljOWZmMjM2NzhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzY3LCJleHAiOjE3ODIzODM3Njd9.qivl9qIoc2o5Ivj8pVgTNMUY1_Tw3G_NFerxhTz_f7A)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDg4OTcwYzJhZjRmNTIwNzViIiwicmVmX2lkIjoiNjczOTZiZDg1OTNmOTljOWZmMjM2NzhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzY3LCJleHAiOjE3ODIzODM3Njd9.MYrXiKxpmt6j0rzeyHZuRcP6TFou7wiy9Gn6O5tmBZw)

 (application/msword)    
