Created by 王仁松, last modified on 六月 14, 2024

# 一、原regress用例

|  
|未通过用例|结果分析|说明|
|---|---|---|---|
|1|tac_nestloop.sql |结果一致|计划不同|
|2|lsc_join_parallel.sql|结果一致|计划不同|
|3|lsc_join_parallel2.sql|结果一致|计划不同|
|4|lsc_join_multiple_runtime_filter.sql|结果一致|计划不同|
|5|cbo_lsc_merge_join.sql|结果一致|计划不同  ，部分数据是顺序不对|


# 二、分布式用例

|  
|未通过用例|结果分析|说明|
|---|---|---|---|
|1|test_cbo_explain|结果一致|计划不同|
|2|test_cbo_group_agg|结果一致|计划不同|
|3|test_cbo_cte|结果一致|计划不同|
|4|test_2_ac_expect|结果一致|计划不同|
|5|test_cbo_query_any_all|结果一致|计划不同|
|6|test_1_join_expect|结果一致|计划不同|
|7|test_setop_expect|结果一致|计划不同|
|8|test_cbo_stable_param|结果一致|计划不同|
|9|test_cbo_parallel|结果一致|计划不同|
|10|test_cbo_chaos|结果一致|计划不同，有用例是关联子查询不支持并行|
|11|test_cbo_base|结果一致|计划不同|
|12|test_cbo_partition_query|结果一致|计划不同|
|13|test_cbo_col_indexscan|结果一致|计划不同|
|14|test_cbo_having|结果一致|计划不同|
|15|test_cbo_agg|结果一致|计划不同|
|16|test_cbo_grouping|结果一致|计划不同|
|17|test_cbo_dml_insert_values|结果一致|计划不同|
|18|test_cbo_orderby|结果一致|计划不同|
|19|test_128_join|栈溢出报错|栈溢出报错（已解决）|
|20|test_cbo_merge_join|结果一致|计划不同|
|21|test_runtime_filter|结果一致|计划不同|
|22|test_cbo_join|结果一致|计划不同|
|23|test_cbo_subplan|结果一致|计划不同|
|24|test_cbo_window_function|结果一致|计划不同|
|25|test_index_nl_join|结果一致|计划不同|
|26|test_cbo_limit_col|结果一致|计划不同|
|27|test_add_cn_node|结果一致|计划不同|
|28|test_1_builtin_task|结果一致|计划不同|
|29|test_auth_expect|结果一致|计划不同|
|30|test_1_role_expect|结果一致|计划不同|
|31|test_cbo_autotrace_pxInfo|结果一致|计划不同|
|32|test_1_expect|结果一致|计划不同|
|33|test_ctas_panic_expect|结果一致|计划不同|
|34|test_2_ddl_expect|结果一致|计划不同|
|35|test_6_ddl_expect|结果一致|计划不同|
|36|test_dml1_expect|结果一致|计划不同|
|37|test_dstb_exec|结果一致|计划不同|
|38|test_outline_by_expect|结果一致|计划不同|
|39|test_px_res_mgr_node_crash|结果一致|计划不同|
|40|test_sqlmap_by_expect|结果一致|计划不同|
|41|test_1_user_expect|结果一致|计划不同|


# 三、二层用例

单机用例：

-   [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/execute_path/nl_ppd](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/execute_path/nl_ppd)  
-   [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/test_Nestloop_full_join](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/test_Nestloop_full_join)  


分布式用例：

-   [https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/DML6/join](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/DML6/join)  


  


结果分析：

单机：

-   [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_kwczgXIj&runId=ci_record_cUha7Roh&lastRunId=ci_record_I4f6Y5p0)  
-   [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_iPntl64R&runId=ci_record_GGHItjHz&lastRunId=ci_record_2m9tnebC)  


分布式：

-   [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_UzwZiFYG&runId=ci_record_kdsVd4iW&lastRunId=ci_record_qzJfdlr2)  
-   [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_ZYgtIG7f&runId=ci_record_a1LCXLqn&lastRunId=ci_record_fqD6G4h4)  


其中单机用例基本都pass，除了内存分配失败的

分布式用例其中主要有两类：

- 一类是因为相同id，顺序不稳定导致结果不稳定，实际结果是正确的
- 一类是cast报错invalid number


# 四、正常合入代码分支跑二层

  [Agile_master_L2_Build #4836 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/4836/)  

除顺序不对，其余都是与nl无关。比如视图变化。

  


# 五、上车前上车工程分析

合入所有改动，rebase master，crab使用改动分支，上车前上车工程分析：

单机：

![](https://pingcode.yasdb.com/atlas/files/public/67396db98970c2af4f5214d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBZ0FCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFCQUFBQUFBQUFBQUFCQUVBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQ1NBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUlBQUJBQUFBSUFRQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExMDMsImV4cCI6MTc4MjMyMTkwM30.A93Y2mQgBRUoN-uyNKa6GYM_nFsiyH6_bSykZVUu--8)

![](https://pingcode.yasdb.com/atlas/files/public/67396db9a1ad9a3311dc9345/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBZ0FCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFCQUFBQUFBQUFBQUFCQUVBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQ1NBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUlBQUJBQUFBSUFRQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExMDMsImV4cCI6MTc4MjMyMTkwM30.A93Y2mQgBRUoN-uyNKa6GYM_nFsiyH6_bSykZVUu--8)

分布式：

![](https://pingcode.yasdb.com/atlas/files/public/67396db9a1ad9a3311dc9346/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBZ0FCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFCQUFBQUFBQUFBQUFCQUVBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQ1NBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUlBQUJBQUFBSUFRQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExMDMsImV4cCI6MTc4MjMyMTkwM30.A93Y2mQgBRUoN-uyNKa6GYM_nFsiyH6_bSykZVUu--8)

![](https://pingcode.yasdb.com/atlas/files/public/67396db9a1ad9a3311dc9347/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBZ0FCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFCQUFBQUFBQUFBQUFCQUVBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQ1NBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUlBQUJBQUFBSUFRQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExMDMsImV4cCI6MTc4MjMyMTkwM30.A93Y2mQgBRUoN-uyNKa6GYM_nFsiyH6_bSykZVUu--8)

  


# 六、三层并行用例

跑工程：

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_sa_heap_yasft_parallel_arm_copy_lxx/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_sa_heap_yasft_parallel_arm_copy_lxx/)      
    [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_sa_tac_yasft_parallel_arm_copy_lxx/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_sa_tac_yasft_parallel_arm_copy_lxx/)      
    [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_sa_lsc_yasft_parallel_arm_copy_lxx/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_sa_lsc_yasft_parallel_arm_copy_lxx/)      
    [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_dst_lsc_yasft_parallel_arm_copy_lxx/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_dst_lsc_yasft_parallel_arm_copy_lxx/)      
    [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_dst_tac_yasft_parallel_arm_copy_lxx/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_dst_tac_yasft_parallel_arm_copy_lxx/)  

  


# 七、tpch测试数据

性能参数设置：

```
alter system set SCOL_DATA_BUFFER_SIZE=28G SCOPE=SPFILE type=DN;
alter system set COLUMNAR_VM_BUFFER_SIZE=20G  SCOPE=BOTH type=ALL;
alter system set DATA_BUFFER_SIZE=500M  SCOPE=SPFILE type=ALL;
alter system set VM_BUFFER_SIZE=500M SCOPE=SPFILE type=ALL;
alter system set SHARE_POOL_SIZE=500M SCOPE=SPFILE type=ALL;
alter system set PQ_POOL_SIZE=1G SCOPE=SPFILE type=ALL;
alter system set TAB_QUEUE_WINDOW_SIZE=1024 SCOPE=SPFILE type=all;
alter system set COLUMNAR_BULK_SIZE = 4096 type=all; 
alter system set COLUMNAR_MAX_OPERATOR_MEM_PERCENT = 80 type=all; 
alter system set COLUMNAR_MAX_STAGE_MEM_PERCENT = 90 type=all; 
alter system set DIN_CONNECTIONS_PER_NODE = 10 SCOPE=SPFILE type=ALL;
alter system set BLOOM_FILTER_FACTOR = 0.5 type=all;
```

  


|  
|q1|q2|q3|q4|q5|q6|q7|q8|q9|q10|q11|q12|q13|q14|q15|q16|q17|q18|q19|q20|q21|q22|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|1.817|62.041|N/A|N/A|N/A|0.08|N/A|571.385|N/A|N/A|38.888|N/A|N/A|277.09|0.019|N/A|224.061|N/A|7.153|N/A|N/A|201.535|
|2|1.928|63.063|N/A|N/A|N/A|0.083|N/A|N/A|N/A|N/A|38.949|N/A|N/A|296.902|0.017|N/A|226.114|N/A|6.794|N/A|N/A|199.166|
|3|1.718|64.061|N/A|N/A|N/A|0.087|N/A|581.151|N/A|N/A|39.062|N/A|N/A|276.044|0.012|N/A|224.91|N/A|6.698|N/A|N/A|198.586|
|4|1.645|65.577|N/A|N/A|N/A|0.081|N/A|596.163|N/A|N/A|38.989|N/A|N/A|276.186|0.019|N/A|221.327|N/A|6.731|N/A|N/A|199.146|
|5|1.598|62.337|N/A|N/A|N/A|0.085|N/A|598.877|N/A|N/A|39.049|N/A|N/A|275.12|0.014|N/A|220.72|N/A|6.511|N/A|N/A|199.731|
|平均值|1.7412|63.4158|  
|  
|  
|0.0832|  
|592.0636667|  
|  
|38.9874|  
|  
|280.2684|0.0162|  
|223.4264|  
|6.7774|  
|  
|199.6328|


## Attachments:

[image2024-6-12_11-28-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjg4OTcwYzJhZjRmNTIxNGNmIiwicmVmX2lkIjoiNjczOTZkYjg1OTNmOTljOWZmMjM3ZWU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTAzLCJleHAiOjE3ODIzOTc1MDN9.o3Cfp0oCfSv0G5RX_4G97q-2EgyydsNZbv7lrWWIi1o)

 (image/png)    


[image2024-6-12_11-29-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjhhMWFkOWEzMzExZGM5MzQzIiwicmVmX2lkIjoiNjczOTZkYjg1OTNmOTljOWZmMjM3ZWU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTAzLCJleHAiOjE3ODIzOTc1MDN9.MQ-OEf0s9u6CKZjQKMoCHTRK1IV5nR9wGazowPPHwY0)

 (image/png)    
