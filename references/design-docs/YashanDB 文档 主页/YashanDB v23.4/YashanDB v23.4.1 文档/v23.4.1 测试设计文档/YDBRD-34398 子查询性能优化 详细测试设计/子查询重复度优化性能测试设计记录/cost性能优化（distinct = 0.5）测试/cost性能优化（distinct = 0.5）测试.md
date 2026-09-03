Created by 刘清萍, last modified on 十一月 14, 2024

### 1.1000w行数据，distinct=0.5测试结果：

版本75a7875416

表1插入1000万行数据，该表中设定一些字段与其他三个表进行关联，插入数据时与其他表关联的列的重复值比例为0.5，第二个表插入1038行数据，第三个表插入335行数据，第4个表插入216条数据。

  点击此处展开...

|序号|场景|测试场景语句（distinct=0.1）|br23.2 SQL执行时间（/s）|br23.2 带优化的SQL执行时间（/s）|master 带优化的SQL执行时间（/s）|master 带优化的SQL执行时间（/s）|oracle执行时间（/s）|提升效率：（未优化/优化）|带优化的与oracle时间相差：（带优化/oracle）|
|:---|:---|:---|:---|:---|:---|---|:---|---|:---|
||||alter session set subquery_ndv_factor = 0;|alter session set subquery_ndv_factor = 1;|alter session set subquery_ndv_factor = -1;|alter session set subquery_ndv_factor = 0;|  
|  
|  
|
|1|in后为静态子查询|select count(*) from bal_detail_000 t1 where taaccountid in (select taaccountid from bal_frozen_detail_000 t2 where SHARETYPE='B' and unfrozenflag = 'N' and DISTRIBUTORCODE<200);|1.505  
1.507
1.465
  **均值:**  1.49|1.486  
1.475
1.475
  **均值:**  1.48|3,,不优化|3|1.09  
0.99
0.98
  **均值:**  1.02|||
|2|c1 in子查询在where之后,有多个外部表达式|select count(*)  
from (
select * from (
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000) t1
where (t1.distributorcode is not null) 
and fundcode in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode));|18.111  
17.979
18.067
  **均值:**  18.05|19.3  
19.058
19.842
  **均值:**  19.40|19.49s|20s|14.76  
14.66
14.63
  **均值:**  14.68|1.026|1.32|
|3|c1 not in子查询在where之后,有多个外部表达式|select count(*)  
from (
select * from (
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000) t1
where (t1.distributorcode is not null) 
and fundcode not in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode));|19.302  
18.936
18.986
  **均值:**  19.07|19.712  
19.732
19.887
  **均值:**  19.78|23s|21s|14.66  
14.71
14.66
  **均值:**  14.68|0.91|1.57|
|4|(c1,c2) in子查询在where之后,有多个投影列和多个外部表达式|select count(*)  
from bal_detail_000 t1 
where (t1.distributorcode > 200) 
or (taaccountid,fundcode) in
(select taaccountid,fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode);|33.232  
32.376
32.452
  **均值:**  32.69|28.57  
26.642
26.958
  **均值:**  27.39|4s|19s|1.43  
1.42
1.43
  **均值:**  1.43|4.75|2.79|
|5|(c1,c2) not in子查询在where之后,有多个投影列和多个外部表达式|select count(*)  
from bal_detail_000 t1 
where (t1.distributorcode > 200) 
or (taaccountid,fundcode) not in 
(select taaccountid,fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode);|33.585  
31.004
30.956
  **均值:**  31.85|25.146  
26.373
25.365
  **均值:**  25.63|27s|35s|1.44  
1.44
1.44
  **均值:**  1.44|1.29|18.75|
|6|子查询在where之后,join在子查询中|select count(*) FROM bal_detail_000 t1 where (taaccountid,distributorcode) in  
(
SELECT taaccountid,distributorcode FROM (
SELECT
t1.tano,t1.TAACCOUNTID,t1.distributorcode,t1.transactionaccountid,t1.fundcode,t1.sharetype
FROM
bal_detail_000 t2
LEFT JOIN bal_frozen_detail_000 t3
ON
t2.tano = t2.tano
AND
t2.fundcode = t2.fundcode
AND
t2.taaccountid = t2.taaccountid
));|31.249  
31.97
31.917
  **均值:**  31.71|26.921  
27.101
27.128
  **均值:**  27.05|12s|13s|7.37  
7.35
7.17
  **均值:**  7.30|1.083|1.64|
|7|exists后为静态子查询,(只会执行一次，与基准版本相比较)|select count(*) from bal_detail_000 t1 where exists (select taaccountid from bal_frozen_detail_000 t2 where SHARETYPE='B' and unfrozenflag = 'N' and DISTRIBUTORCODE<200);    
|1.241  
1.216
1.22
  **均值:**  1.23|1.212  
1.228
1.229
  **均值:**  1.22|2s|18s|0.45  
0.45
0.45
  **均值:**  0.45|9|4.44|
|8|简单exists子查询，在where之后,有多个外部表达式|select count(*)  
from bal_detail_000 t1
where t1.distributorcode !=0 or exists
(select taaccountid 
from bal_frozen_detail_000 t2 where t1.taaccountid = t2.taaccountid and t1.fundcode=t2.fundcode);|24.357  
21.214
21.212
  **均值:**  22.26|19.052  
18.832
18.843
  **均值:**  18.91|2.7s|2.7s|1.11  
1.11
1.11
  **均值:**  1.11|1|2.43|
|9|简单not exists子查询，在where之后,有多个外部表达式|select count(*)  
from bal_detail_000 t1
where t1.distributorcode !=0 or not exists
(select taaccountid 
from bal_frozen_detail_000 t2 where t1.taaccountid = t2.taaccountid and t1.fundcode=t2.fundcode);|22.879  
21.085
21.088
  **均值:**  21.68|18.814  
18.368
18.422
  **均值:**  18.53|2.7s|2.7s|1.11  
1.11
1.1
  **均值:**  1.11|1|2.43|
|10|exists子查询在父查询的投影列|select exists (select  
DISTRIBUTORCODE
from (se  ~~l~~  ect  
count(*)
from
bal_detail_000 t1
inner join bal_frozen_detail_000 t2 on t1.fundcode = t2.fundcode
)) as c1,
TAACCOUNTID 
from acct_loaning_clear;|59.498  
64.129
64.096
  **均值:**  62.57|68.356  
73.641
73.393
  **均值:**  71.80|2.6s|9分05s|  
|||
|11|exists子查询在子查询的投影列|select count(*)  
from bal_detail_000 t1 where exists 
(select taaccountid,distributorcode,(
select
DISTRIBUTORCODE
from
(select
count(*)
from
bal_detail_000 t2
inner join bal_frozen_detail_000 t3 on t2.fundcode = t3.fundcode
)) as c2 from bal_frozen_detail_000);|1.234  
1.21
1.212
  **均值:**  1.22|1.218  
1.23
1.23
  **均值:**  1.23|2.37s|13s|0.45  
0.45
0.45
  **均值:**  0.45|5.48|5.26|
|12|exists子查询在case when中|select count(*)  
from (select taaccountid,distributorcode,branchcode,fundcode,
max(case when BALSTATUS='0' then 1 else 0 end)as a,
avg(fundvol) as su
from bal_detail_000 t1 group by taaccountid,distributorcode,branchcode,fundcode having exists (select TASERIALNO 
from 
bal_frozen_detail_000 t2 where t2.taaccountid=t1.taaccountid and t2.BRANCHCODE=t1.BRANCHCODE
and t2.distributorcode > '205'));|16.878  
17.406
16.823
  **均值:**  17.04|20.991  
20.033
20.227
  **均值:**  20.42|27s|22s|11.51  
9.93
10.03
  **均值:**  10.49|0.81|2.57|
|13|exists子查询在having中|select count(*) from (select taaccountid,distributorcode,branchcode,fundcode,    
               max(case when BALSTATUS='0' then 1 else 0 end)as a,    
               avg(fundvol) as su from bal_detail_000 t1 group by taaccountid,distributorcode,branchcode,fundcode having exists (select TASERIALNO from bal_frozen_detail_000 t2 where t2.taaccountid=t1.taaccountid and t2.BRANCHCODE=t1.BRANCHCODE and t2.distributorcode > '205'));|23.248  
20.132
20.034
  **均值:**  21.14|27.442  
26.66
26.935
  **均值:**  27.01|27.7s|21s|10.13  
10.09
9.9
  **均值:**  10.04|0.77|2.77|
|14|exists子查询在where之后,join在子查询内|select count(*) FROM bal_detail_000 t1 where exists   
(
SELECT taaccountid,distributorcode FROM (
SELECT
t1.tano,t1.TAACCOUNTID,t1.distributorcode,t1.transactionaccountid,t1.fundcode,t1.sharetype
FROM
bal_detail_000 t2
LEFT JOIN bal_frozen_detail_000 t3
ON
t2.tano = t2.tano
AND
t2.fundcode = t2.fundcode
AND
t2.taaccountid = t2.taaccountid
));|29.768  
28.775
28.756
  **均值:**  29.10|24.945  
24.836
25.04
  **均值:**  24.94|12.6s|12.9s|6.38  
6.18
6.09
  **均值:**  6.22|1.023|2.02|
|15|兄弟关联：,where in子查询 or exists子查询|select count(*)  
from (select * from (
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000
union all
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from BAL_FROZEN_DETAIL_000
) t1
where (t1.distributorcode is not null) 
and fundcode in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode)
or
exists (
select 1 from cfg_realtfundseatagency_clear t3
where t3.distributorcode = t1.distributorcode
and t3.fundcode = t1.fundcode));|275.19  
275.067
275.488
  **均值:**  275.25|284.413  
292.856
284.755
  **均值:**  287.34|222s|221s|199.73  
200.35
199.57
  **均值:**  199.88|1|1.11|
|16|兄弟关联：,where in子查询 and exists子查询|select count(*)  
from (
select * from (
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000
union all
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from BAL_FROZEN_DETAIL_000
) t1
where (t1.distributorcode is not null) 
and fundcode not in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode)
and ( t1.distributorcode !=0 or 
exists (
select 1 from cfg_realtfundseatagency_clear t3
where t3.distributorcode = t1.distributorcode
and t3.fundcode = t1.fundcode)));|287.311  
287.288
287.92
  **均值:**  287.51|292.769  
300.336
293.316
  **均值:**  295.47|240s|240s|16.75  
16.68
16.67
  **均值:**  16.70|1|15|
|17|双层关联子查询，子查询和父查询分别嵌套爷查询|select count(*)  
from bal_detail_000 t1 
where t1.distributorcode in 
(select distributorcode
from (select * from BAL_FROZEN_DETAIL_000 t2 where t1.fundcode = t2.fundcode) t where t1.distributorcode !=0 or EXISTS (
select 1 from cfg_realtfundseatagency_clear t3 
where t3.distributorcode = t1.distributorcode
and t3.fundcode = t1.fundcode));|943.412  
943.178
944.107
  **均值:**  943.57|937.87  
939.495
939.078
  **均值:**  938.81|960s|954s|277.76  
278.16
276.91
  **均值:**  277.61|1|3.45|
|18|双层关联子查询，子查询嵌套父查询，父查询嵌套爷查询|select count(*)  
from 
bal_detail_000 t1
where (t1.distributorcode is not null) 
and 
fundcode not in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode 
and (t1.taaccountid !=0 or exists (
select 1 from cfg_realtfundseatagency_clear t3
where t3.distributorcode = t2.distributorcode)));|31.269  
30.938
31.083
  **均值:**  31.10|25.33  
25.14
25.157
  **均值:**  25.21|26.3s|33s|17.01  
17.07
17.03
  **均值:**  17.04|1.25|1.5|
|19|双层关联子查询，子查询分别嵌套父查询和爷查询|select count(*)  
from 
bal_detail_000 t1
where (t1.distributorcode is not null) 
and 
fundcode not in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode 
or exists (
select 1 from BAL_FROZEN_DETAIL_000 t3
where t3.taaccountid = t2.distributorcode 
and t3.distributorcode = t2.distributorcode 
and t3.TRANSACTIONACCOUNTID = t1.TRANSACTIONACCOUNTID 
and t3.FUNDCODE = t1.FUNDCODE));|4430.087|2999.627|||1513.34|||
||复杂查询（外场语句）|select count(*) FROM    
  (    
      SELECT tano,taaccountid,distributorcode,branchcode,transactionaccountid,fundcode FROM (    
          SELECT    
              CASE WHEN t1.balstatus='0' THEN 0 ELSE NVL(t1.lastfundvol, 0)+NVL(t1.fundvol, 0)-NVL(t3.abnmfrozenvol, 0) END AS available,t1.tano,t1.TAACCOUNTID,t1.distributorcode,t1.transactionaccountid,t1.fundcode,t1.sharetype,branchcode,FOOTINCOME     
          FROM    
              bal_detail_000 t1    
          LEFT JOIN (    
          SELECT    
              t2.tano, t2.fundcode, t2.taaccountid, t2.distributorcode,t2.transactionaccountid, t2.origintaserialno,t2.sharetype,SUM(NVL(t2.frozen, 0) + NVL(t2.lastfrozen, 0)) AS abnmfrozenvol     
          FROM    
              bal_frozen_detail_000 t2    
          WHERE    
              t2.unfrozenflag = 'N'    
          GROUP BY    
              t2.tano, t2.fundcode, t2.taaccountid, t2.distributorcode,t2.transactionaccountid, t2.origintaserialno,t2.sharetype) t3    
          ON    
              t3.tano = t1.tano    
          AND    
              t3.fundcode = t1.fundcode    
          AND    
              t3.taaccountid = t1.taaccountid    
          AND    
              t3.distributorcode = t1.distributorcode    
          AND    
              t3.transactionaccountid = t1.transactionaccountid    
          AND     
              t3.sharetype = t1.sharetype    
          AND    
              t3.origintaserialno = t1.taserialno    
      ) t    
      WHERE    
          (t.distributorcode = '205' and substr(t.transactionaccountid, 14, 1) = 1)    
      OR EXISTS (    
              select 1 from cfg_realtfundseatagency_clear a    
              where a.distributorcode = t.distributorcode    
              and a.fundcode = t.fundcode    
      )    
      OR EXISTS (    
          select 1 from acct_loaning_clear a    
          where a.distributorcode = t.distributorcode    
          and a.taaccountid = t.taaccountid    
          and a.transactionaccountid = t.transactionaccountid    
          and a.distributorcode = '205'    
          and a.loaningstatus = '1'    
          and a.effectivestatus = 'N'    
      )    
  );|340.145  
344.651
354.253
  **均值:**  346.35|338.737  
334.612
338.881
  **均值:**  337.41|235s|233s|187.3  
186.34
187.46
  **均值:**  187.03|1|1.25|


