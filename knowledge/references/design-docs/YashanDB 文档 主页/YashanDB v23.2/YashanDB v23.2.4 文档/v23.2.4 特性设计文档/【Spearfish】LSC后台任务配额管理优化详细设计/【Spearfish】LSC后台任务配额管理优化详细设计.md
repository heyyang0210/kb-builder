Created by 谢锐, last modified on 七月 10, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/666188865d57e18ea9d20156](https://pingcode.yasdb.com/ship/ideas/666188865d57e18ea9d20156)    *?*    
  *#YASHAN-2909 后台任务内存配额优化*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-总述)  

XFMR任务当前的配额管理机制不够完善：

1，最小额度不明确且部分必须内存未提前申请

2，最大额度512M，在任务间不共享。

3，多任务上限可用完物化内存，导致查询无法执行。

所以我们需要使用目前的quotator机制(上下限+争用) 来改造XFMR内存使用。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-需求来源)  

该需求来自于内部识别。

请参考：    [AP场景内存易用性可靠性和可维护性问题](https://conf.yasdb.com/pages/viewpage.action?pageId=153012995)  

同时也有相应的问题单：“    [https://pingcode.yasdb.com/pjm/items/66430dcf288e1978208aa244](https://pingcode.yasdb.com/pjm/items/66430dcf288e1978208aa244)    ?    
  #YDBRD-27076 【CI】dev_L2_dst_lsc_yasft_arm工程并发报VmBuffer不足，冷热数据强制转换失败”

  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-调研文档)  

**概述**   友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  


#### 1.2.1 LSC XFMR当前的实现

  


|  
|问题|说明|改进|
|---|---|---|---|
|1|当前XFMR如何使用内存|1，createXfmr任务主要是CoralExecuteCtx上使用，即扫描的上下文。,2，transform和compact在执行阶段都会fetch数据，在内存积攒排序，以及最后写入。 这几个步骤都涉及columnar vm buffer使用。,3， clean任务基本不涉及,4， ac的执行过程主体在ac.rs，OperatorQuota控制|  
|
|2|当前配额是如何管理的|初始大小columnarMaxSortMem/16,扩展大小columnarMaxSortMem/16,columnarMaxSortMem同时作为sorter的capacity,当sorter内存用量超过capacity时就启用VM。否则按照某个比例进行扩展ankSorterCritial。,cosWriter内容通过CVM来管理(sliceInitWriterMemCtx), 使用handler上的quotator。初始配额在init时分配，后续会尝试拓展，扩展不了就淘汰（这里有预留机制 CORAL_QUOTOR_HWM）。|1，使用上下限+争用的quota机制来管理sorter内存。,2  ，sorter配额不单独检查(ankSorterCritial)，与coastWriter共享,3，coastWriter配额提前申请|
|3|当前如何控制上限|1，控制了xfmrPromise总数，按每个promise使用columnarMaxSortMem，把columnarMaterial均分。,2，最大物化内存,  
|1，总数通过quota机制来控制|
|4|涉及哪些部分的配额|1，查询,2，排序,3，生成|  
|
|5|XFMR不同类型下的配额管理差异|见1|1，改造转换和合并的实现，create和buildAc咱不修改|


  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-需求分析)  

  


1,  移除columnarMaxSortMem单个xfmr任务限制，xfmr单个任务不限制，增加xfmr总配额，最多不超过上限。

2，sorter内存用量通过上下限配额控制，与xfmr生成slice共享handler配额。

     下限要保证可以成功，同时有基本的性能保证。

    上限通过新的配置项控制。

3，xfmr并发数量通过配额来控制。实际申请不了配额则等待。

  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语1|描述|是|业界资料链接|
|---|---|---|---|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-开源依赖)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**   SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

  


### 2.1 配置项

删减配置项：COLUMNAR_MAX_SORT_MEM

新增配置项：TRANSFORMER_MAX_MEM_PERCENT

  


  


* 参数类型：数值

* 默认值：80

* 取值范围/格式：\[1,100\]

* 参数说明：指定后台转换任务使用的内存占COLUMNAR_MATERIAL_PERCENT的上限百分比。如果当前后台任务积压很多，建议适当调大此参数。

* 修改立即生效：是

* 会话级参数：否

* 只读参数：否

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-规格与约束)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**   规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-特性)  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-特性设计)  

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-特性功能点2)    增加参数TRANSFORMER_MAX_MEM_PERCENT

       增加参数，并通过该参数限制XFMR总的内存。

       移除  COLUMNAR_MAX_SORT_MEM，通过  TRANSFORMER_MAX_MEM_PERCENT限制任务数量。

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-特性性能点1)    修改ColSort配额实现

  


1，在启动任务时评估sorter和coastWriter的配额需求。此需求可保证后台任务成功或极大概率成功。

      coastWriter已有实现，sorter增加内存评估函数。xfmrPromiseLimit根据能否以申请配额来启动任务。



最小内存计算方法：

compact任务：16M(sorter初始) + max(16M,Avg(rowGroupBytes)*4)*SORT_SOURCE + MIN(128M,sum(SliceSize)*4) + coastWriter，其中4是压缩系数，稍微有些放大。

transform任务：16M(sorter初始) + MAX(Avg(rowGroupBytes), 16M) + MIN(sliceSize, 128M) + coastWriter.

没法绝对保证不失败，但大概率可以确保不失败。

实测：如对于表T1(c1 int,c2 int);  转换最小内存需求为40M，合并最小内存需求为56M。

  


2，sorter的扩展需求通过配额扩展来实现。要求整体不超过TRANSFORMER_MAX_MEM_PERCENT限定。

      根据当前使用率来扩展，如当前使用率超过额定值，则按step进行扩展。否则即判定内存即将不足，采取换出措施。

  


3，增加sorter的swap统计，辅助优化配置项

4，解决col sorter换出放大问题

     配额不足时，不需要做整体sorter的换出，这样存在放大问题。

     改为：

     配额不足时将internal source按需要换出，直到quota not full。

     merge node达到上限时，提前做一次merge(merge 结果换出)，这时将所有source换出，这种情况下仍然会有swap放大。

    默认merge node为64个，如果quota严重不足，那么放大仍然会很严重。由于上面我们已经占了128M配额，按照目前情况看内部实际留给排序的只有40M左右(内部做了预留)。

    正常64 * 40M也基本够用。

  


  


###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-特性性能点2)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-特性可维可测设计)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-特性安全设计)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

  


|  
|测试点|预期|测试结果|
|---|---|---|---|
|1|内存不满足最小要求|无法启动xfmr|通过|
|2|配置项测试|配置项范围符合预期,COLUMNAR_MAX_SORT_MEM设置成功，日志  提示过期|通过|
|3|内存足够xfmr启动，但不足存下所有排序数据|xfmr成功运行，不报错|之前存在换出放大问题一并处理，增加了sysstat统计项SCOL TRANSFORM SORT SWAP BYTES 分析sorter换出情况,通过|
|4|大量xfmr任务在一定内存配额(参数)下运行|1，任务数量符合预期,2，内存上限不超过配置的额度|测试2G内存下，跑4个1G多的xfmr compact不报错。出现了sorter和coast writer的换出。,测试2G内存下，跑6个1G多的xfmr compact，同时执行TPCH Q1，执行成功。查询未见失败。,通过|
|5|  
|  
|  
|


  


上车情况：

|失败工程|原因分析|措施|  
|
|---|---|---|---|
|Agile_L2_sa_heap_HA_1_docker|ha用例，不相关|  
|  
|
|Agile_L2_sa_upgrade_FT_2_docker,Agile_L2_sa_upgrade_FT_1_docker|升级类用例，不相关|  
|  
|
|Agile_L2_sa_heap_HA_5_docker|ysteam用例失败，不相关|  
|  
|
|Agile_L2_sa_heap_HA_4_docker|test_sdv_backup_archive,配额不足|1，xfmr任务支持等待|已解决|
|Agile_L2_sa_tac_yasft_arm,Agile_L2_sa_lsc_yasft_arm,Agile_L2_sa_heap_yasft_arm|1，有报xfmr配额不足,2，也有内存分配失败，在极端情况下仍然保证不了，尤其是总内存只有2G的情况下|1，内存较少时，进一步调低xfmr配置,2，xfmr任务支持等待,3，太多并跑时适当加大vm buffer内存。|已解决|
|Agile_L2_cluster_yasft_faultpoint_arm|有一个失败，错误信息很少，看不出原因|  
|  
|
|Agile_L2_cluster_FT_install_arm|有一个失败，看起来该工程的 Allure Report有问题|  
|  
|
|Agile_L2_sa_FT_expimp_1|dblink相关用例失败，不相关|  
|  
|
|Agile_L2_sa_heap_yasft_arm|/system_view/test_sdv_ydbrd_15210|需刷用例，增加视图项|  
|
|Agile_L2_dst_tac_yasft_arm|  
|需刷用例，增加视图项,配置项|  
|
|Agile_L2_dst_lsc_yasft_arm|databucket空间使用的用例失败|需刷用例，增加视图项,配置项|已解决|
|  
|  
|  
|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。