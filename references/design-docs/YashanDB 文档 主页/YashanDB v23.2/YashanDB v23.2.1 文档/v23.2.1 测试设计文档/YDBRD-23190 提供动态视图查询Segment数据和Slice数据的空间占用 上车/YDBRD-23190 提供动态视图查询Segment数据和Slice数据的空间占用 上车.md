Created by 董灵林, last modified on 一月 17, 2024

SR：    [YDBRD-23190](https://jira.yasdb.com/browse/YDBRD-23190?src=confmacro)    -  提供动态视图查询Segment数据和Slice数据的空间占用  完成

  


上车工程链接：    [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/3754/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/3754/)  

|序号|分类|失败工程|首次失败原因|处理方式|重跑记录|处理结果|
|---|---|---|---|---|---|---|
|1|单机    
    
|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1908/)  |超时|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1917/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1917/)  ,结果：重跑失败，失败原因：1.视图用例需要修改预期；2.内存报错；3.to_char/to_date函数报错。修改预期重跑last_fail,第2次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1922/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1922/)  ,结果：剩余失败用例与CI责任人确认与SR无关|修改视图用例预期后，剩余失败用例与SR无关|
|2||  [Agile_L2_sa_lsc_HA_4_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/2387/)  |用例执行成功，归档日志数量不符合预期|预期错误，不处理|  
|无需处理|
|3||  [Agile_L2_sa_heap_driver_python_debug_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/46/)  |超时|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/53/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/53/)  ,结果：工程执行成功|重跑通过|
|4|集群    
    
    
|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1453/)  |环境偶现问题|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1461/](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1461/)  ,结果：重跑失败，失败原因：1.部分用例order by排序不稳定；2.部分用例预期错误。失败用例与SR特性相关，不需要再处理,![](https://pingcode.yasdb.com/atlas/files/public/67396bb68970c2af4f520683/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NzMsImV4cCI6MTc4MjMwNzI3M30.G2w1grUqT7ng-O1ntknkwQvUdgVHXMZ1nxErCsJq3WM)|修改视图用例预期后，剩余失败用例与SR无关|
|5||  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1477/)  |超时|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1484/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1484/)  ,结果：重跑失败，失败原因：1.视图用例需要修改预期；2.审计日志查询结果不对；3.to_char/to_date函数报错。,第2次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1487/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1487/)  ,结果：剩余失败用例13个，已跟CI责任人确认与SR无关|修改视图用例预期后，剩余失败用例与SR无关|
|6||  [Agile_L2_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/1357/)  |超时|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/1364/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/1364/)  ,结果：工程执行成功|重跑通过|
|7||  [Agile_L2_cluster_backup_arm_1](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/1103/)  |用例版本落后与db版本|rebase用例重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1461/](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1461/)  ,结果：工程执行成功|重跑通过|
|8|分布式|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/848/)  |超时|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/857/](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/857/)  ,结果：重跑失败，失败原因：1.视图用例需要修改预期；2.报错信息变化；3.to_char/to_date函数报错。修改视图用例预期重跑last_fail,第2次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/860/](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/860/)  ,结果：剩余失败用例3个，都与SR无关|修改视图用例预期后，剩余失败用例与SR无关|
|9||  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/884/)  |超时|重跑|第1次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/893/](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/893/)  ,结果：重跑失败，失败原因：视图用例需要修改预期。修改视图用例预期重跑last_fail,第2次重跑：,链接：    [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/896/](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/896/)  ,结果：工程执行成功|修改视图用例预期重跑通过|
|  
|  
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|


## Attachments: