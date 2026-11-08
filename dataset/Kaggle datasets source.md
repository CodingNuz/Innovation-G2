# Kaggle dataset sources

Every file below was downloaded with the Kaggle command line tool. The licence
shown is the one Kaggle reports for the dataset page.

| folder | author | licence | dataset | files used |
| --- | --- | --- | --- | --- |
| `uciml` | Esther Kim (UCI ML Repository) | unknown | [SMS Spam Collection](https://www.kaggle.com/datasets/uciml/sms-spam-collection-dataset) | `sms_master.csv` |
| `gokhansoyturk` | Gokhan Soyturk | MIT | [Smishing SMS Dataset](https://www.kaggle.com/datasets/gokhansoyturk/smishing-sms-dataset) | `combined_sms.csv` |
| `naserabdullahalam` | Naser Abdullah Alam | CC BY-SA 4.0 | [Phishing Email Dataset](https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset) | `email_ceas.csv`, `email_enron.csv`, `email_ling.csv`, `email_nigerian.csv`, `email_phishing.csv`, `email_spamassassin.csv` |
| `joebeachcapital` | Joakim Arvidsson | CC BY 4.0 | [Windows Malwares](https://www.kaggle.com/datasets/joebeachcapital/windows-malwares) | `PE_Header.csv` |
| `joebeachcapital` | Joakim Arvidsson | CC BY 4.0 | [TUANDROMD](https://www.kaggle.com/datasets/joebeachcapital/tuandromd) | `TUANDROMD.csv` |
| `amauricio` (`mauricio`) | amauricio | CC0 | [Benign & Malicious PE Files](https://www.kaggle.com/datasets/amauricio/pe-files-malwares) | `dataset_malwares.csv` |
| `saurabhshahane` | Saurabh Shahane | CC BY 4.0 | [Android Malware Dataset](https://www.kaggle.com/datasets/saurabhshahane/android-malware-dataset) | `drebin-215-dataset-5560malware-9476-benign.csv` |
| `ankit1743` | Ankit Bhardwaj | CC0 | [Android Malware Detection Dataset](https://www.kaggle.com/datasets/ankit1743/android-malware-detection-dataset) | `Android_Malware.csv` |
| `nsaravana` | N Saravana | CC0 | [Malware Detection](https://www.kaggle.com/datasets/nsaravana/malware-detection) | `Malware dataset.csv` |

## Downloads

```bash
kaggle datasets download -d uciml/sms-spam-collection-dataset --unzip -p dataset/uciml
kaggle datasets download -d gokhansoyturk/smishing-sms-dataset --unzip -p dataset/gokhansoyturk
kaggle datasets download -d naserabdullahalam/phishing-email-dataset --unzip -p dataset/naserabdullahalam
kaggle datasets download -d joebeachcapital/windows-malwares --unzip -p dataset/joebeachcapital
kaggle datasets download -d joebeachcapital/tuandromd --unzip -p dataset/joebeachcapital
kaggle datasets download -d amauricio/pe-files-malwares --unzip -p dataset/mauricio
kaggle datasets download -d saurabhshahane/android-malware-dataset --unzip -p dataset/saurabhshahane
kaggle datasets download -d ankit1743/android-malware-detection-dataset --unzip -p dataset/ankit1743
kaggle datasets download -d nsaravana/malware-detection --unzip -p dataset/nsaravana
```

Some downloads arrive under the author's own file names. They were renamed to
the names used here (`spam.csv` to `sms_master.csv`, `dataset.csv` to
`drebin-215-dataset-5560malware-9476-benign.csv`, `CEAS_08.csv` to
`email_ceas.csv`, and so on) so the column names and file names match what
`build_datasets.py` expects. Each source folder has an `INFO.md` with the
details.

## Sources that were downloaded and rejected

| source | why it is not used |
| --- | --- |
| `ang3loliveira/malware-analysis-datasets-pe-section-headers` | 96 to 97% malware, so there is no benign class to learn from |
| `rtatman/the-national-university-of-singapore-sms-corpus` | no label column, so the rows cannot be trained or scored |
| `nsaravana/malware-detection` used for classification | each of the 100 processes is repeated 1000 times and every snapshot of a process carries the same label, so a classifier would identify the process. The file is used for regression instead. |
| `saurabhshahane/android-permission-dataset` | 1,927 package IDs appear with both labels, so the rows are genuinely ambiguous |

## Malware platform expansion (all sources are Kaggle)

Every source below feeds only the malware side. Each folder has an `INFO.md`
with the exact download command, licence, label column and any reproducible
sampling that was applied.

| folder | Kaggle dataset | OS / case |
| --- | --- | --- |
| `greenwarbler` | `greenwarbler/malware-benignpe-files` | Windows PE |
| `saurabhshahane` | `saurabhshahane/classification-of-malwares` | Windows PE (CLaMP) |
| `luccagodoy` | `luccagodoy/obfuscated-malware-memory-2022-cic` | Windows memory |
| `ang3loliveira` | `ang3loliveira/malware-analysis-datasets-api-call-sequences` | Windows dynamic API |
| `bishwajitprasadgond` | `bishwajitprasadgond/malware-benign-api-call-argument-feature-vector` | Windows API arguments |
| `oriolakolawole` | `oriolakolawole/ransomware-and-goodware-pe-header` | Windows ransomware |
| `jeffborschowa` | `jeffborschowa/malwarebazaar-threat-intelligence-csv` | macOS / Office / scripts / ELF / cross-OS classifier |
| `krishna1502` | `krishna1502/pegasus-spyware-attacksynthetic-dataset` | iOS / Apple mobile |
| `sanjayrohith` | `sanjayrohith/elf-firmware-static-summary-features` | Linux ELF |
| `datamunge` | `datamunge/iot-firmware-image-classification` | embedded firmware |
| `ahmadzulfiqar001` | `ahmadzulfiqar001/iot-malware-dataset` | Linux / Embedded Linux / FreeRTOS / OpenWRT |
| `gundalaxmisai` | `gundalaxmisai/iot-23-malware-typescombined-dataset` | IoT network |
| `nkongolo` | `nkongolo/ugransome-dataset` | network attacks |
| `shashwatwork` | `shashwatwork/android-malware-dataset-for-machine-learning` | Android Drebin |
| `dannyrevaldo` | `dannyrevaldo/android-malware-detection-dataset` | Android permissions |
| `satyaprakash138` | `satyaprakash138/cleaned-cic-pdf-malware-2022-dataset` | PDF documents |
| `kk0105` | `kk0105/cicpdfmal2022` | PDF documents |
| `dooschoi` | `dooschoi/malpdf-efs-malicious-pdf-enhanced-feature-set` | PDF documents |
| `fouadtrad2` | `fouadtrad2/evasive-pdf-samples` | PDF documents |
| `fanbyprinciple` | `fanbyprinciple/obfuscated-javascript-dataset` | JavaScript |
| `thedevastator` | `thedevastator/assembly-shellcode-dataset` | shellcode |
| `xwolf12` | `xwolf12/malicious-and-benign-websites` | websites |
| `ndarvind` | `ndarvind/phiusiil-phishing-url-dataset` | URL features |
| `sahandnamvar` | `sahandnamvar/phishing-url-detection-111k-urls-22-features` | URL features |
| `victusadi` | `victusadi/phishing-urls-dataset-with-extracted-features` | URL features |
| `sid321axn` | `sid321axn/malicious-urls-dataset` | URL text / defacement |
| `beaaaaaan` | `beaaaaaan/programmatically-generated-security-logs-v1` | cloud logs |

## Layered scanner reuse

The `malware_engine` specialists reuse the Kaggle tables already listed above
(PE header sets, the CIC / evasive PDF sets and the three Android sets). No new
dataset was downloaded for the scanner: the EMBER 2018 v2 parquet files and
the cleanware-ember set were deliberately excluded, and the engine's
machine-local `local_index` and `github` corpora were not ported. Everything
the scan path trains on has a `kaggle.com/datasets` reference.
