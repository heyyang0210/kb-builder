Created by 张欣, last modified on 五月 15, 2024

|编号|工程链接|失败用例数|失败用例及原因|解决方式|
|---|---|---|---|---|
|1|  [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_heap_yasft_arm/2806/)  ,  [view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_heap_yasft_arm/2806/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_heap_yasft_arm/2806/)  |  
|/dml1/cte/test_ydbrd_23640_CTE/test_ydbrd_23640_CTE_013   重名对象需要改用例,/dml1/dynamic_cons_optmization/plsql/test_sr21659_06_plsql 替换,/dml1/dynamic_cons_optmization/plsql/test_sr21659_05_plsql 替换,/dml5/test_sdv_null_func/heap/test_sdv_null_heap_normalTable06_01 udt比较 待确认,/function3/OLAP_func/heap/test_sdv_OLAP_listagg 3个 替换,/function3/date_add/heap/test_sdv_func_date_add_09-10 不相关 主干已替换,/function6/date_sub/heap 不相关 主干已替换,/function6/string_agg/test_string_agg_heap_001 替换,/function6/test_sdv_group_concat/test_sr_group_concat_006 替换,/function6/wm_concat/heap/test_wm_concat_heap_005 替换,/plsql/Static_SQL/udttype 3个 替换,/plsql/Static_SQL/variasub/test_sdv_variasub_jg_027_suanshubiaodashi 替换,/plsql/Static_SQL/variasub/test_sdv_variasub_jg_031_function_record 替换,/plsql/Static_SQL/variasub/test_sdv_variasub_jg_034_condition_udt 替换,/plsql/Static_SQL/variasub/test_sdv_variasub_jg_036_condition_udt_2 待确认,/plsql/bind_variable_peeking/heap/Anonymous/test_variable_binding_peeking_002 替换,/plsql/bind_variable_peeking/heap/UDP/test_variable_binding_peeking_UDP_009 替换,/plsql/bind_variable_peeking/heap/UDP/test_variable_binding_peeking_UDP_011  替换,/plsql/bind_variable_peeking/heap/procedure 10个 替换,/plsql/bulkcollect_standalone_jiagu 3个 替换,/plsql/constant/test_sdv_constant_value_009 替换,/plsql/execute_immediate 3个 替换,/plsql/forall_standalone  替换,/plsql/forall_standalone_jiagu/test_sdv_forall_jg_011_int 替换,/plsql/forall_standalone_jiagu/test_sdv_forall_jg_022_execute_pkg_udt_2  替换,/plsql/forall_standalone_jiagu/test_sdv_forall_jg_023_execute_pkg_udt_3 待确认,/plsql/null_expression/heap/Anonymous 5个 替换 给晓旋同步下,/plsql/null_expression/heap/procedure 2个 替换,/plsql/procedure/heap/procedure_01/test_sdv_procedure_194   重名对象需要改用例,/plsql/process_ctrl_jg/test_sdv_process_control_jg_003_02  cursor、for里需要加别名。  改用例,/plsql/reinforce/heap,/plsql01/YDBRD_reinforce：,/plsql01/YDBRD_reinforce/test_sdv_YDBRD17953_005 cursor、for里需要加别名。  改用例,/plsql01/YDBRD_reinforce/test_sdv_YDBRD17953_021  cursor、for里需要加别名。  改用例,/plsql01/YDBRD_reinforce/test_sdv_YDBRD17953_022  cursor、for里需要加别名。  改用例,其余换预期,/plsql01/test_plsql_sit：,/plsql01/test_plsql_sit/test_sdv_YDBRD22973_  xxx   cursor、for里需要加别名。  改用例,/plsql01/test_plsql_sit/test_sit_YDBRD13970_001 /plsql01/test_plsql_sit/test_sit_YDBRD13970_002 替换,/plsql01/test_sdv_cte/test_sdv_plsql_cte_040 cursor、for里需要加别名。  改用例,/plsql01/test_sit_typedefine/test_sdv_typedefine_038 cursor、for里需要加别名。  改用例,/plsql01/test_sit_udrein 替换,/plsql_UDT/UDT_OBJECTS/test_sdv_udt_obj_281_286 有MAP,ORDER方法的object 不支持in,any，all等。无方法的支持,/plsql_UDT/array_func_all/array_ndims，/plsql_UDT/array_func_all/array_position， 替换,/plsql_UDT/test_sdv_nstb/nested_table_case_zx/test_sdv_YDBRD4268_st_064  替换,/plsql_UDT/test_sdv_nstb/test_sdv_table4268_lme/test_sdv_table4268_086   待确认,/plsql_UDT/test_sdv_nstb/test_sdv_table4268_lme  替换,/plsql_UDT/test_sdv_ydbrd_22986/test_sdv_ydbrd_22986_005,/plsql_UDT/test_sit_YDBRD_12833 ,/plsql_cursor/cursor_jg/test_sit_cursor_reinforce_06_02   改用例,/plsql_cursor/static_cursor/test_sdv_static_cursor_46_55    改用例,/plsql_cursor/static_cursor/test_sdv_static_cursor_88     改用例,剩最后system view两个目录|  
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
|  
|  
|
|  
|  
|  
|  
|  
|
