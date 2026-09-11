Created by 刘清萍, last modified on 十一月 14, 2024

### 1.1000w行数据，distinct=0.1测试结果：

版本75a7875416

表1插入1000万行数据，该表中设定一些字段与其他三个表进行关联，插入数据时与其他表关联的列的重复值比例为0.1，第二个表插入1038行数据，第三个表插入335行数据，第4个表插入216条数据。

  点击此处展开...

|序号|场景|测试场景语句（distinct=0.1）|br23.2 SQL执行时间（/s）|br23.2 带优化的SQL执行时间（/s）|master 带优化的SQL执行时间（/s）|master 带优化的SQL执行时间（/s）|oracle执行时间（/s）|提升效率：（未优化/优化）|带优化的与oracle时间相差：（带优化/oracle）|
|:---|:---|:---|:---|:---|:---|---|:---|---|:---|
||||alter session set subquery_ndv_factor = 0;|alter session set subquery_ndv_factor = 1;|alter session set subquery_ndv_factor = -1;|alter session set subquery_ndv_factor = 0;|  
|  
|  
|
|1|in后为静态子查询|select count(*) from bal_detail_000 t1 where taaccountid in (select taaccountid from bal_frozen_detail_000 t2 where SHARETYPE='B' and unfrozenflag = 'N' and DISTRIBUTORCODE<200);|1.726  
1.422
1.441
  **均值：**  1.530|1.443  
1.452
1.422
  **均值：**  1.439|4|4|0.94  
0.94
1
  **均值：**  0.960|0.977 |1.609 |
|2|c1 in子查询在where之后,有多个外部表达式|select count(*)  
from (
select * from (
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000) t1
where (t1.distributorcode is not null) 
and fundcode not in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode));|17.443  
20.36
20.393
  **均值：**  19.399|7.16  
7.153
7.203
  **均值：**  7.172|||3.21  
3.17
3.16
  **均值：**  3.180|0.984 |11.627 |
|3|c1 not in子查询在where之后,有多个外部表达式|select count(*)  
from (
select * from (
select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000) t1
where (t1.distributorcode is not null) 
and fundcode not in
(select fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode));|19.778  
22.826
19.041
  **均值：**  20.548|7.398  
7.456
7.463
  **均值：**  7.439|8.8s|9.1s|3.26  
3.23
3.24
  **均值：**  3.243|0.997 |11.587 |
|4|(c1,c2) in子查询在where之后,有多个投影列和多个外部表达式|select count(*)  
from bal_detail_000 t1 
where (t1.distributorcode > 200) 
or (taaccountid,distributorcode) in
(select taaccountid,distributorcode 
from 
ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode);|36.618  
34.336
34.48
  **均值：**  35.145|8.137  
8.291
8.110
  **均值：**  8.179|10||1.64  
1.63
1.62
  **均值：**  1.630|0.996 |1.656 |
|5|(c1,c2) not in子查询在where之后,有多个投影列和多个外部表达式|select count(*)  
from bal_detail_000 t1 
where (t1.distributorcode > 200) 
or (taaccountid,fundcode) not in 
(select taaccountid,fundcode 
from 
ACCT_LOANING_CLEAR t2 where t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode);|35.279  
30.531
32.412
  **均值：**  32.741|8.398  
8.372
8.49
  **均值：**  8.420|||1.68  
1.66
1.67
  **均值：**  1.670|0.998 |2.864 |
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
));|31.808  
31.606
32.687
  **均值：**  32.03|9.776  
9.957
10.171
  **均值:**  9.97   


|11.4s|11.38|5.38  
5.27
5.51
  **均值：**  5.387|0.987 |2.803 |
|7|exists后为静态子查询,(只会执行一次，与基准版本相比较)|select count(*) from bal_detail_000 t1 where exists (select taaccountid from bal_frozen_detail_000 t2 where SHARETYPE='B' and unfrozenflag = 'N' and DISTRIBUTORCODE<200);    
|1.224  
1.199
1.2
  **均值：**  1.208|1.199  
1.203
1.231
  **均值：**  1.211|2s|19s|0.46  
0.45
0.45
  **均值：**  0.453|7.461 |2.733 |
|8|简单exists子查询，在where之后,有多个外部表达式|select count(*)  
from bal_detail_000 t1
where t1.distributorcode !=0 or exists
(select taaccountid 
from bal_frozen_detail_000 t2 where t1.taaccountid = t2.taaccountid and t1.fundcode=t2.fundcode);|21.04  
21.072
21.005
  **均值：**  21.039|5.546  
5.549
6.728
  **均值：**  5.941|2.8s|2.7s|1.06  
1.05
1.06
  **均值：**  1.057|0.999 |  
|
|9|简单not exists子查询，在where之后,有多个外部表达式|select count(*)  
from bal_detail_000 t1
where t1.distributorcode !=0 or not exists
(select taaccountid 
from bal_frozen_detail_000 t2 where t1.taaccountid = t2.taaccountid and t1.fundcode=t2.fundcode);|22.344  
22.417
22.395
  **均值：**  22.385|6.331  
6.37
6.446
  **均值：**  6.382|||1.06  
1.06
1.05
  **均值：**  1.057|0.988 |2.823 |
|10|exists子查询在父查询的投影列（静态子查询）|select exists (select  
DISTRIBUTORCODE
from (select
count(*)
from
bal_detail_000 t1
inner join bal_frozen_detail_000 t2 on t1.fundcode = t2.fundcode
)) as c1,
TAACCOUNTID 
from acct_loaning_clear;|188.941  
196.689
196.684
  **均值：**  194.105|188.84  
196.745
196.924
  **均值：**  194.170|3s,|11s|  
|2.515 |2.134 |
|11|exists子查询在子查询的投影列（静态子查询）|select count(*)  
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
)) as c2 from bal_frozen_detail_000);|1.203  
1.198
1.199
  **均值：**  1.200|1.213  
1.199
1.24
  **均值：**  1.217|2.5s|14s|0.45  
0.45
0.44
  **均值：**  0.447|0.993 |1.922 |
|12|exists子查询在case when中|select count(*)  
from (select taaccountid,distributorcode,branchcode,fundcode,
max(case when BALSTATUS='0' then 1 else 0 end)as a,
avg(fundvol) as su
from bal_detail_000 t1 group by taaccountid,distributorcode,branchcode,fundcode having exists (select TASERIALNO 
from 
bal_frozen_detail_000 t2 where t2.taaccountid=t1.taaccountid and t2.BRANCHCODE=t1.BRANCHCODE
and t2.distributorcode > '205'));|17.103  
16.755
16.778
  **均值：**  16.879|10.023  
9.804
10.332
  **均值：**  10.05|11.9s|10s|4.90  
4.71
4.73
  **均值：**  4.780   

|0.998 |2.131 |
|13|exists子查询在having中|select count(*)  
from (select taaccountid,distributorcode,branchcode,fundcode,
max(case when BALSTATUS='0' then 1 else 0 end)as a,
avg(fundvol) as su
from bal_detail_000 t1 group by taaccountid,distributorcode,branchcode,fundcode having exists (select TASERIALNO 
from 
bal_frozen_detail_000 t2 where t2.taaccountid=t1.taaccountid and t2.BRANCHCODE=t1.BRANCHCODE
and t2.distributorcode > '205'));|8.349  
8.328
8.314
  **均值：**  8.330|9.417  
9.45
10.098
  **均值：**  9.655|11s|10s|4.74  
4.6
4.7
  **均值：**  4.680|1.004 |2.828 |
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
));|29.194  
29.563
29.016
  **均值：29.258 **    
|8.547  
8.632
8.691
  **均值：**  8.623|10.9s|10.9s|4.29  
4.32
4.26
  **均值：**  4.290|2.394 |1.367 |
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
and t3.fundcode = t1.fundcode));|66.413  
66.109
66.115
  **均值：**  66.212|59.294  
59.426
59.846
  **均值：**  59.522|53s|63s|40.93  
40.9
40.86
  **均值：**  40.897|1.426 |10.204 |
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
and t3.fundcode = t1.fundcode)));|84.617  
84.3
84.233
  **均值：**  84.383|64.243  
66.023
64.456
  **均值：**  64.907|58s|85s|4.47  
4.46
4.47
  **均值：**  4.467|1.642 |3.392 |
|17|双层关联子查询，子查询和父查询分别嵌套爷查询|select count(*)  
from bal_detail_000 t1 
where t1.distributorcode in 
(select distributorcode
from (select * from BAL_FROZEN_DETAIL_000 t2 where t1.fundcode = t2.fundcode) t where t1.distributorcode !=0 or EXISTS (
select 1 from cfg_realtfundseatagency_clear t3 
where t3.distributorcode = t1.distributorcode
and t3.fundcode = t1.fundcode));|203.133  
202.499
202.396
  **均值：**  202.676|189.572  
190.736
190.054
  **均值：**  190.121|3分21s|3分40s|56.85  
56.82
56.93
  **均值：**  56.867|0.993 |20.412 |
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
where t3.distributorcode = t2.distributorcode)));|30.524  
30.554
30.552
  **均值：**  30.543|8.196  
9.087
9.079
  **均值：**  8.787|9s|34s|3.77  
3.77
3.82
  **均值：**  3.787|5.445 |14.865 |
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
and t3.FUNDCODE = t1.FUNDCODE));|执行时间非常久|146.245  
165.937
160.067
  **均值：**  157.416||10分57秒|80.41  
79.95
80.35
  **均值：**  80.237|3.210 |3.017 |
||复杂查询（外场语句）|select count(*) FROM  
(SELECT tano,taaccountid,distributorcode,branchcode,transactionaccountid,fundcode FROM (
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
t3.origintaserialno = t1.taserialno) t
WHERE
(t.distributorcode = '205' and substr(t.transactionaccountid, 14, 1) = 1)
OR EXISTS (
select 1 from cfg_realtfundseatagency_clear a
where a.distributorcode = t.distributorcode
and a.fundcode = t.fundcode)
OR EXISTS (
select 1 from acct_loaning_clear a
where a.distributorcode = t.distributorcode
and a.taaccountid = t.taaccountid
and a.transactionaccountid = t.transactionaccountid
and a.distributorcode = '205'
and a.loaningstatus = '1'
and a.effectivestatus = 'N'));|107.175  
110.611
106.56
  **均值：**  108.115|75.758  
76.731
78.231
  **均值：**  76.907|58s|85s|39.31  
39.44
39.25
  **均值：**  39.333|||


